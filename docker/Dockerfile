FROM --platform=linux/amd64 ubuntu@sha256:2edbbc5dc405e9612ba3584ce95480277e3eb374407b5505fe26f17df77c7dbc

ARG CDT_VERSION

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        findutils \
        gawk \
        make \
    && rm -rf /var/lib/apt/lists/*

RUN test -n "${CDT_VERSION}" || { echo "CDT_VERSION build arg is required"; exit 1; } \
    && curl -fsSL -o /tmp/cdt.deb \
        "https://github.com/AntelopeIO/cdt/releases/download/v${CDT_VERSION}/cdt_${CDT_VERSION}-1_amd64.deb" \
    && apt-get update \
    && apt-get install -y --no-install-recommends /tmp/cdt.deb \
    && rm -f /tmp/cdt.deb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /repo
