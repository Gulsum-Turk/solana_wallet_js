// arayüzden verileri almak için kullanılan kütüphane
const express = require('express');
// dosya işlemleri için kütüphane
const fs = require('fs');
// solananın web3 kütüphanesi
const web3 = require('@solana/web3.js');
// kullanıcıdan input almak için kütüphane
const readline = require('readline');

// verileri almak için oluşturulan app
const app = express();
const port = 3000;

// verileri yazmak için json dosyasının yolu
const dataFilePath = './wallet.json';

// cüzdan ve bağlantı tanımlama
let wallet;
let connection;

// public dizinini express apisine tanıtır
app.use(express.static('public'));
// json formatına dönüştürür
app.use(express.json());

// gelen bilgileri okur
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// solana ağına bağlantı yapılır
async function initConnection() {
    connection = new web3.Connection(web3.clusterApiUrl("testnet"), "confirmed");
}



// data dosyası sıfırlanır
async function resetWallet() {

    // data.json dosyasını sıfırla
    fs.writeFileSync(dataFilePath, '[]');

    console.log('Cüzdan dosyası sıfırlandı.');


}


// yeni cüzdan bilgileri kaydedilir
async function saveWallet() {
    let existingWallets = [];

    if (fs.existsSync(dataFilePath)) {
        const existingData = fs.readFileSync(dataFilePath, 'utf8');
        try {
            existingWallets = JSON.parse(existingData);
            if (!Array.isArray(existingWallets)) {
                existingWallets = [];
            }
        } catch (error) {
            console.error('JSON verisi analiz edilemiyor:', error);
            existingWallets = [];
        }
    }

    // Yeni cüzdan ana cüzdan olarak belirlenir
    const newWallet = {
        publicKey: wallet.publicKey.toString(),
        privateKey: wallet.secretKey.toString()
    };

    // Yeni cüzdanı mevcut cüzdanlar listesine ekler
    existingWallets.push(newWallet);

    fs.writeFileSync(dataFilePath, JSON.stringify(existingWallets, null, 2));
    console.log('Yeni cüzdan kaydedildi.');
}




// yeni cüzdan oluşturulur ve ana cüzdan olarak ayarlanır
async function createWalletAndSetAsMain() {
    const newWallet = web3.Keypair.generate();
    wallet = newWallet;
    await saveWallet();
    console.log('Yeni cüzdan oluşturuldu ve ana cüzdan olarak belirlendi.');
}

//cüzdan bakiyesi kontrol edilir
async function checkBalance() {
    const balance = await connection.getBalance(wallet.publicKey);
    console.log('Cüzdan bakiyesi:', balance);
}

// airdrop istenir
async function requestAirdrop(wallet, amount) {
    const signature = await connection.requestAirdrop(wallet.publicKey, web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);
    console.log(`${amount} airdrop başarıyla eklendi.`);
}

// token transferi yapılır
async function transferTokens(destinationKey, amount) {
    const destinationPubKey = new web3.PublicKey(destinationKey);
    const transaction = new web3.Transaction().add(
        web3.SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: destinationPubKey,
            lamports: amount
        })
    );
    const signature = await web3.sendAndConfirmTransaction(connection, transaction, [wallet]);
    console.log(`${amount} token ${destinationKey} adresine transfer edildi.`);
}


// istemciden post geldiğinde çalışır
// posttan gelen veriyi command değişkenine atar
app.post('/command', async (req, res) => {
    const command = req.body.command;
    let output = '';

    // kontroller
    switch (command.split(' ')[0]) {
        case 'new':
            await createWalletAndSetAsMain();
            output = 'Yeni cüzdan oluşturuldu ve kaydedildi.';
            break;
        case 'balance':
        output = await checkBalance();
            break;
        case 'airdrop':
            const amount = parseInt(command.split(' ')[1]);
            if (!amount || isNaN(amount)) {
                output = 'Geçersiz miktar. Lütfen bir sayı girin.';
                break;
            }
            await requestAirdrop(wallet, amount);
            output = `${amount} airdrop başarıyla eklendi.`;
            break;
        case 'transfer':
            const destinationKey = command.split(' ')[1];
            const transferAmount = parseInt(command.split(' ')[2]);
            if (!destinationKey || !transferAmount || isNaN(transferAmount)) {
                output = 'Geçersiz transfer işlemi. Lütfen hedef adres ve geçerli bir miktar girin.';
                break;
            }
            await transferTokens(destinationKey, transferAmount);
            output = `${transferAmount} token ${destinationKey} adresine transfer edildi.`;
            break;
        default:
            output = 'Geçersiz komut.';
            break;
    }

    // html dosyasına output verisi gönderilir.
    res.send(output);
});




// gçerli port üzerinden gelen verileri dinlenme işleminin başlamasıdır.
app.listen(port, async () => {
    console.log(`Sunucu çalışıyor: http://localhost:${port}`);
    await initConnection();
    await resetWallet();
});
