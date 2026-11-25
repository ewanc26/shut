FROM node:24-slim
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY labeller/package.json labeller/
RUN pnpm install --frozen-lockfile --prod --filter shut-labeller
COPY labeller/tsconfig.json labeller/
COPY labeller/src labeller/src
RUN mkdir data && chown node:node data
USER node
WORKDIR /app/labeller
ENV HOST=0.0.0.0 PORT=14831 DATA_DIR=/app/data
EXPOSE 14831
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/xrpc/_health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "src/server/main.ts"]
