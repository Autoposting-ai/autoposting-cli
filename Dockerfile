FROM node:20-alpine
RUN npm install -g autoposting-cli
ENTRYPOINT ["ap"]
