FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
EXPOSE 3001
CMD ["sh", "-c", "npm run db:migrate && npm run server"]
