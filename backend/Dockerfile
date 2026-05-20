FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
# Install all dependencies so development commands (like start:dev) are available.
RUN npm install || npm install --registry=https://registry.npmjs.org

COPY . .

RUN npm run prisma:generate && npm run build

CMD ["node", "dist/main.js"]
