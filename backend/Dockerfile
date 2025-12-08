# Use Bun official image
FROM oven/bun:1.1-debian

# Install system dependencies for native modules (bcrypt, etc.)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]
