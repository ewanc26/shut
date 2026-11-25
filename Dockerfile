FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN mkdir data && chown node:node data
USER node
ENV HOST=0.0.0.0 PORT=14831 DATA_DIR=/app/data
EXPOSE 14831
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/xrpc/_health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "src/server/main.ts"]
