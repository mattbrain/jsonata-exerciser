# Use an official Node.js runtime as a parent image
FROM node:18

# Install dependencies for canvas module
RUN apt-get update && apt-get install -y \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install any needed packages specified in package.json
RUN npm install

# Copy the rest of the application source code to the working directory
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "start"]
