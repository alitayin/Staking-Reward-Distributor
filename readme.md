# SRD - eCash Staking Reward Distributor

SRD is an automated tool for distributing eCash staking rewards. It periodically checks your payout address, and if there are rewards exceeding 0.625M xec, it distributes them proportionally.

## How to Install and Use

Here are the detailed steps to install and use:

1. **Clone the code**

    Clone this repository to your local environment.

    ```bash
    git clone https://github.com/alitayin/Staking-Reward-Distributor.git
    ```

    Navigate to the project directory:

    ```bash
    cd Staking-Reward-Distributor
    ```

2. **Install dependencies**

    Install the required dependencies.

    ```bash
    npm install
    ```

3. **Set up environment variables**

    Create a `.env` file and set the environment variables. Open the file using `nano`:

    ```bash
    nano .env
    ```

    Inside the `.env` file, provide your PRIVATE_KEY_WIF and UTXO_ADDRESS. Note that the UTXO_ADDRESS should match your payout address:

    ```bash
    PRIVATE_KEY_WIF=<your_private_key>
    UTXO_ADDRESS=<your_utxo_address> // same as your payout address
    ```

4. **Run the application**

    After everything is set up, you can run the application using:

    ```bash
    node app.js
    ```

    The application will be running on port 3333,(http://localhost:3333) localhost=your vps ip.  so make sure this port is allowed through your firewall.

5. **Configure the distribution**

    Now you can visit the application in your web browser and set up the specific reward destination addresses for each address.

6. **Optional: Use pm2 to keep the application running**

    To keep the application running in the background, you can use `pm2`:

    ```bash
    npm install pm2 -g
    pm2 start app.js
    ```

    To stop the application, you can use `pm2 stop app.js`.


This tool checks every 10 seconds. If your payout address has more than 0.625M xec, it will automatically distribute the rewards proportionally based on the addresses you specified in the settings.

Please note that this process is not completely trustless, as you receive the rewards of the stakes delegated to you. Even if you send the rewards out right away, this brief control over other user's funds can be considered a money transmitter service. It is not recommended to provide staking services in a commercial manner with this tool, without holding a money transmitter license or other necessary licensing.
