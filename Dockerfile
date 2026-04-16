FROM node:20-alpine

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
