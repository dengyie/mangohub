FROM alpine:3.21

WORKDIR /app

# Docker buildx 会在构建时自动填充这些变量
ARG TARGETOS
ARG TARGETARCH

COPY --chmod=755 mango-agent-${TARGETOS}-${TARGETARCH} /app/mango-agent

RUN touch /.mango-agent-container

ENTRYPOINT ["/app/mango-agent"]
# 运行时请指定参数
# Please specify parameters at runtime.
# eg: docker run mango-agent -e example.com -t token
CMD ["--help"]
