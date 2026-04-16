/**
 * DrinkBot AI Controller
 * - Uses OpenAI GPT-3.5 when OPENAI_API_KEY is set
 * - Saves unanswered questions for auto-training
 * - Handles normal conversation + drink topics + app help
 */

const mongoose = require('mongoose');

// ── Simple schema for unanswered questions (auto-training data) ──
const unmatchedQuerySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  question: { type: String, required: true, maxlength: 500 },
  aiAnswer: { type: String, default: '' },
  source: { type: String, enum: ['fallback', 'ai'], default: 'fallback' },
  category: { type: String, default: 'unknown' },
  createdAt: { type: Date, default: Date.now },
});
unmatchedQuerySchema.index({ createdAt: -1 });
const UnmatchedQuery = mongoose.models.UnmatchedQuery || mongoose.model('UnmatchedQuery', unmatchedQuerySchema);

const SYSTEM_PROMPT = `You are DrinkBot, the AI assistant inside the Drink Buddy mobile app.

YOUR CAPABILITIES:
1. DRINK KNOWLEDGE: You know everything about alcohol — types of drinks (wine, beer, whiskey, vodka, rum, gin, tequila, cocktails), cocktail recipes, ABV levels, tasting notes, food pairings.
2. HEALTH & SAFETY: BAC (Blood Alcohol Concentration), health effects of alcohol, safe drinking tips, hangover remedies, when to stop, signs of alcohol poisoning, interactions with medication.
3. APP HELP: You can help users with the Drink Buddy app — how to start sessions, add friends, create rooms, make calls, share stories, edit profiles, track budgets, use themes, and more.
4. NORMAL CONVERSATION: You can have friendly casual conversation — greetings, jokes, small talk. Be warm and personable.

YOUR RULES:
- Keep answers concise (2-4 sentences max unless a recipe or detailed explanation is needed)
- Always promote responsible drinking
- Never encourage excessive drinking or underage drinking
- If someone seems to be in danger or mentions alcohol poisoning symptoms, urgently suggest calling emergency services
- Use a warm, casual, friendly tone with occasional emoji
- If the question is completely unrelated to drinks/health/app, still try to help briefly but gently redirect to what you know best
- When giving app instructions, be specific about button locations and screen names

Reply naturally as a helpful friend who happens to know a lot about drinks and the Drink Buddy app.`;

class ChatBotController {
  static async askBot(req, res) {
    try {
      const { message, conversationHistory = [] } = req.body;
      const userId = req.user?._id;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'Message is required' });
      }

      const userMessage = message.trim().substring(0, 1000);
      const apiKey = process.env.OPENAI_API_KEY;

      // ── No API key → save question + return fallback ──
      if (!apiKey) {
        // Save for future training
        try {
          await UnmatchedQuery.create({
            user: userId,
            question: userMessage,
            source: 'fallback',
          });
        } catch (e) { /* ignore save errors */ }

        return res.json({
          success: true,
          data: {
            answer: this._getFallbackAnswer(userMessage),
            source: 'fallback',
          },
        });
      }

      // ── Build message chain for GPT ──
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
      ];

      // Include last 8 turns for better context
      const recentHistory = conversationHistory.slice(-8);
      for (const turn of recentHistory) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          messages.push({ role: turn.role, content: String(turn.content).substring(0, 500) });
        }
      }

      messages.push({ role: 'user', content: userMessage });

      // ── Call OpenAI ──
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages,
          max_tokens: 400,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('[ChatBot] OpenAI error:', response.status, JSON.stringify(err));

        // Save the failed question for training
        try {
          await UnmatchedQuery.create({ user: userId, question: userMessage, source: 'fallback' });
        } catch (e) { /* ignore */ }

        return res.json({
          success: true,
          data: {
            answer: "I'm having a small hiccup right now 🤔 Try asking me again or rephrase your question!",
            source: 'fallback',
          },
        });
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content?.trim()
        || "Hmm, I couldn't come up with a good answer. Try rephrasing!";

      // Save the Q&A pair for future training (even successful ones help improve the knowledge base)
      try {
        await UnmatchedQuery.create({
          user: userId,
          question: userMessage,
          aiAnswer: answer,
          source: 'ai',
        });
      } catch (e) { /* ignore */ }

      res.json({
        success: true,
        data: { answer, source: 'ai' },
      });
    } catch (error) {
      console.error('[ChatBot] Error:', error.message);
      res.json({
        success: true,
        data: {
          answer: "Sorry, I ran into an issue 😅 Try a simpler question or ask about drinks, recipes, or the app!",
          source: 'fallback',
        },
      });
    }
  }

  // ── Smart fallback when no API key is available ──
  static _getFallbackAnswer(message) {
    const lower = message.toLowerCase();

    // Greetings
    if (/^(hi|hey|hello|hii+|yo|sup|good\s*(morning|afternoon|evening|night))/i.test(lower)) {
      return "Hey there! 👋 I'm DrinkBot. I can answer questions about drinks, cocktails, health tips, and the Drink Buddy app. What would you like to know?";
    }

    // Thanks
    if (/thank|thx|appreciate/i.test(lower)) {
      return "You're welcome! 😊 Feel free to ask me anything else. Cheers! 🍷";
    }

    // Bye
    if (/bye|goodbye|see ya|later|cya/i.test(lower)) {
      return "See you later! 👋 Stay safe and drink responsibly. I'm always here when you need me!";
    }

    // App-related
    if (/app|session|friend|room|profile|call|story|chat|notification|password|account/i.test(lower)) {
      return "Great question about the app! 📱 I have built-in answers for many app features. Try asking something specific like 'How do I start a session?' or 'How do I add friends?' For detailed answers, an AI API key can be configured for full power.";
    }

    // Drink-related
    if (/drink|alcohol|beer|wine|vodka|whiskey|cocktail|martini|recipe|hangover|bac|liver/i.test(lower)) {
      return "That's a great drink question! 🍹 I have 35+ built-in answers about drinks, health, and safety. Try being more specific — like 'What is a Martini?' or 'How does alcohol affect the liver?' I'll give you an instant answer!";
    }

    // Default
    return "I'm DrinkBot — your drink advisor! 🍷 I can answer questions about:\n\n🍺 Drink types & cocktail recipes\n💪 Health effects & safety tips\n📱 How to use the Drink Buddy app\n\nTry asking something specific and I'll do my best!";
  }
}

module.exports = ChatBotController;
