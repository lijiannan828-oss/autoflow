FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv git wget \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -s /bin/bash comfyui
WORKDIR /home/comfyui

# Clone ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /home/comfyui/ComfyUI \
    && cd /home/comfyui/ComfyUI && git checkout v0.3.12

# Install Python deps
RUN cd /home/comfyui/ComfyUI \
    && pip3 install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124 \
    && pip3 install --no-cache-dir -r requirements.txt

# Model dirs (will be mounted or populated later)
RUN mkdir -p /home/comfyui/ComfyUI/models/checkpoints \
    /home/comfyui/ComfyUI/models/loras \
    /home/comfyui/ComfyUI/models/vae \
    /home/comfyui/ComfyUI/models/unet \
    /home/comfyui/ComfyUI/models/clip \
    /home/comfyui/ComfyUI/input \
    /home/comfyui/ComfyUI/output

RUN chown -R comfyui:comfyui /home/comfyui
USER comfyui

EXPOSE 8188

CMD ["python3", "/home/comfyui/ComfyUI/main.py", "--listen", "0.0.0.0", "--port", "8188"]
