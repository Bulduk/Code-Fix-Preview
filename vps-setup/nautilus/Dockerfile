FROM python:3.12-slim

# Nautilus Trader sistem bağımlılıkları
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl git libssl-dev pkg-config \
    libpq-dev gcc g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# UV ile hızlı kurulum
RUN pip install uv

COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

COPY . .

EXPOSE 8091
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8091", "--workers", "1"]
