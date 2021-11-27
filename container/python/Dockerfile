FROM python

# Avoid warnings by switching to noninteractive
ENV DEBIAN_FRONTEND=noninteractive

RUN python3 -m pip install pandas tqdm

RUN git config --global user.email "pythondev"
RUN git config --global user.name "pythondev"

# Switch back to dialog for any ad-hoc use of apt-get
ENV DEBIAN_FRONTEND=dialog
