# Use official Node.js 20 LTS image
FROM node:20

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy all files
COPY . .

# Expose port (optional, only if needed for web/QR)
EXPOSE 3000

# Use environment variables for owner number and API key
ENV OWNER=""
ENV FOOTBALL_API_KEY=""

# Command to start the bot
CMD ["node", "index.js"]