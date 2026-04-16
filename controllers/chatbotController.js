/**
 * DrinkBot AI Controller
 * Uses OpenAI GPT-3.5 when OPENAI_API_KEY is set, otherwise returns a fallback.
 */

const SYSTEM_PROMPT = `You are DrinkBot, a friendly and responsible alcohol advisor for the DrinkBuddy app.
You help with drink types, cocktail recipes, BAC information, health effects, safety tips, and drinking laws.
Always promote responsible drinking. Keep answers concise (2-4 sentences max).
Never encourage excessive drinking. If someone seems to be in danger, suggest they call emergency services.
Reply in a warm, casual tone with occasional emoji. If the question is unrelated to drinks/alcohol/health, politely redirect.`;

class ChatBotController {
  static async askBot(req, res) {
    try {
      const { message, conversationHistory = [] } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'Message is required' });
      }

      const apiKey = process.env.OPENAI_API_KEY;

      // ── No API key → graceful fallback ──
      if (!apiKey) {
        return res.json({
          success: true,
          data: {
            answer: "I can answer common questions about drinks, cocktails, health, and safety tips! Try asking about a specific drink type, recipe, or health effect. For more detailed answers, the app owner can add an AI API key.",
            source: 'fallback',
          },
        });
      }

      // ── Build message chain for GPT ──
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
      ];

      // Include last 6 turns of conversation for context
      const recentHistory = conversationHistory.slice(-6);
      for (const turn of recentHistory) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          messages.push({ role: turn.role, content: String(turn.content).substring(0, 500) });
        }
      }

      messages.push({ role: 'user', content: message.trim().substring(0, 1000) });

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
          max_tokens: 300,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('[ChatBot] OpenAI error:', response.status, JSON.stringify(err));
        return res.json({
          success: true,
          data: {
            answer: "I'm having trouble thinking right now. Try asking a simpler question or check back in a moment!",
            source: 'fallback',
          },
        });
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content?.trim() || "Hmm, I couldn't come up with a good answer. Try rephrasing your question!";

      res.json({
        success: true,
        data: { answer, source: 'ai' },
      });
    } catch (error) {
      console.error('[ChatBot] Error:', error.message);
      res.json({
        success: true,
        data: {
          answer: "Sorry, I ran into an issue. Try a simpler question or ask about drink types, recipes, or safety tips!",
          source: 'fallback',
        },
      });
    }
  }
}

module.exports = ChatBotController;
