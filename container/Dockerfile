FROM ubuntu

# Avoid warnings by switching to noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# Configure apt and install packages
RUN apt-get update \
    && apt-get -y install sudo git curl \
    && curl -sL https://deb.nodesource.com/setup_12.x | bash - \
    && sudo apt-get -y install nodejs \
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/* \
    && node --version \
    && npm --version

# bashrc additionals
#COPY ./.mybashrc /root
#RUN echo "" >> ~/.bashrc
#RUN echo "source .mybashrc" >> ~/.bashrc

# Switch back to dialog for any ad-hoc use of apt-get
ENV DEBIAN_FRONTEND=dialog
