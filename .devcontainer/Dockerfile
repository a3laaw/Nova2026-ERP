# بيئة تطوير محمولة — تعمل في أي محرر يدعم Dev Containers
# (VS Code / Cursor / Windsurf / GitHub Codespaces / JetBrains / أي Docker).
# الغرض: لا يعود المشروع معتمداً على منصة التطوير التي أُغلقت. راجع docs/migration-runbook.md §3 المرحلة 7.
FROM mcr.microsoft.com/devcontainers/base:bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git unzip \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y nodejs \
 && rm -rf /var/lib/apt/lists/*

# أدوات المشروع مثبتة عالمياً حتى يشتغل `firebase emulators:start` من أول لحظة
RUN npm install -g firebase-tools@13

WORKDIR /workspaces/Nova2026-ERP
