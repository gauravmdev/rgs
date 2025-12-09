# Build Stage
FROM oven/bun:alpine as build
WORKDIR /app
COPY package*.json ./
RUN bun install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN bun run build

# Serve Stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copy custom nginx config if available, otherwise default serves index.html usually
# Assuming we want to use the one we created in root, but for now let's copy a local one or inline it if possible.
# Ideally we copy the nginx.conf from the context. 
# Since docker context usually is the app dir, we might need to duplicate nginx.conf or adjust build context.
# To keep it simple self-contained:
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
    try_files $uri $uri/ /index.html; \
    } \
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
