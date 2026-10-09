// Mastering Bitcoin study cohort: settings and curriculum.
// Edit this file to change the start date, open/close sign-ups, or adjust weeks.
// Bump the ?v= on its <script> tag in mastering-bitcoin.html after editing.
window.MB_COHORT = {
  // First Monday of the cohort as "YYYY-MM-DD", or null while the date is still TBA.
  // If you change it, also update assets/mastering-bitcoin/sessions.ics.
  startDate: "2026-11-16",
  // Sessions: Mondays 7–8:30pm UTC+8 (11:00–12:30 UTC), on Discord.
  sessionUtcHour: 11,
  sessionMinutes: 90,
  sessionLabel: "Mondays, 7pm UTC+8",
  signupsOpen: true,
  discord: "https://discord.gg/ZtvA79paWa",
  bookUrl: "https://github.com/bitcoinbook/bitcoinbook/blob/develop/BOOK.md",

  // Socratic seminar roles, rotated through the roster each week (shown in this order).
  roles: [
    { name: "Facilitator", job: "Keeps time, asks the opening question and brings in quiet voices. Guides, doesn't lecture." },
    { name: "Summariser", job: "Notes the key takeaways and open questions, and posts them on Discord within a day." },
    { name: "Devil's advocate", job: "Steelmans the other side and asks \"why not do it differently?\"" },
    { name: "Exercise driver", job: "Shares their screen and walks the group through one of the hands-on exercises." },
  ],

  // Each week: an opening question for everyone, then questions with one owner each.
  // Question and exercise ids (w3-q2, w3-e1) are stored with students' "done" ticks:
  // reword freely, but don't renumber them once the cohort has started.
  weeks: [
    {
      title: "Orientation",
      chapters: [
        { n: 1, title: "Introduction", file: "ch01_intro.adoc" },
        { n: 2, title: "How Bitcoin Works", file: "ch02_overview.adoc" },
      ],
      opening: "If you had to explain Bitcoin to a friend in two sentences, what would you say, and what would you leave out?",
      summary: "Meet the cohort, learn how the dashboard works, and read the two short opening chapters. Get Bitcoin Core installed so you're ready for week 2.",
      questions: [
        "What problem did Bitcoin solve that earlier digital cash attempts could not?",
        "The book says there are no coins, only transaction outputs. What does that mean?",
        "Walk through Alice's purchase from Bob's store: who builds the transaction, who checks it, and when is it final?",
        "What is a confirmation, and why might a merchant wait for more than one?",
        "Why does the book stress who controls the keys when choosing a wallet? Compare custodial and self-custodial wallets.",
        "In the Chapter 2 story, what is mining doing besides creating new bitcoin?",
      ],
      exercises: [
        "Introduce yourself in the cohort channel on Discord: your background, why you joined, and what you'd like to build.",
        "Open a recent block on mempool.space, pick one transaction, and note its inputs, outputs and fee.",
        "Install Bitcoin Core from bitcoincore.org and start it on signet (bitcoind -signet -daemon) so it syncs before week 2.",
      ],
    },
    {
      title: "Bitcoin Core",
      chapters: [{ n: 3, title: "Bitcoin Core: The Reference Implementation", file: "ch03_bitcoin-core.adoc" }],
      opening: "Why run your own node at all when a block explorer shows the same data?",
      summary: "Run your own node and talk to it through the command line and JSON-RPC API.",
      questions: [
        "What is the difference between Bitcoin and Bitcoin Core, and why is Core called the reference implementation?",
        "What does pruning do, and what can a pruned node not do that an archival node can?",
        "What does the txindex option enable, and why is it off by default?",
        "How does bitcoin-cli talk to bitcoind? Explain JSON-RPC and how it is authenticated.",
        "Name two alternative clients or libraries from the chapter and when you'd pick one over Bitcoin Core.",
        "Why does it matter that anyone can compile Bitcoin Core from source?",
      ],
      exercises: [
        "Run bitcoin-cli -signet getblockchaininfo and getnetworkinfo. Post your block height, verification progress and number of connections.",
        "Use getblockhash and getblock to fetch block 1000 on signet. How many transactions does it have?",
        "Pick a transaction from that block and decode it with getrawtransaction <txid> true <blockhash>. List its inputs and outputs.",
      ],
    },
    {
      title: "Keys and Addresses",
      chapters: [{ n: 4, title: "Keys and Addresses", file: "ch04_keys.adoc" }],
      opening: "An address is not an account. What goes wrong when people treat it like one?",
      summary: "Public key cryptography, output scripts and every address format from P2PK to bech32m.",
      questions: [
        "Explain how a private key, public key and address relate. Which steps are one-way, and why?",
        "Why are compressed public keys smaller, and why did they cause wallet compatibility problems?",
        "What does Base58check add over plain Base58, and why does that matter for people typing addresses?",
        "How does P2SH shift the cost and complexity of a script from the sender to the receiver?",
        "Why did bech32m replace bech32 for segwit version 1 (taproot) addresses?",
        "What are vanity addresses, and what's the risk of letting someone else generate one for you?",
      ],
      exercises: [
        "Create a wallet and call getnewaddress with legacy, p2sh-segwit, bech32 and bech32m. Compare the prefixes and lengths.",
        "Run getaddressinfo on one of those addresses and find its scriptPubKey and public key.",
        "Decode a bech32 address with a library or by hand and identify its witness version and witness program.",
      ],
    },
    {
      title: "Wallet Recovery",
      chapters: [{ n: 5, title: "Wallet Recovery", file: "ch05_wallets.adoc" }],
      opening: "Your house burns down tonight. What exactly do you need to get your bitcoin back?",
      summary: "Deterministic wallets, BIP32 key derivation, BIP39 recovery codes and output script descriptors.",
      questions: [
        "Why did deterministic wallets replace wallets full of independent random keys?",
        "What is an extended public key (xpub), and why is leaking an xpub plus one child private key dangerous?",
        "Explain hardened versus normal derivation and when you'd use each.",
        "What does a BIP39 recovery code encode, and what is the optional passphrase for?",
        "Why can a seed alone be not enough to recover a wallet? Where do output script descriptors come in?",
        "Read the path m/84'/0'/0'/0/0 level by level. What does each part mean?",
      ],
      exercises: [
        "Run listdescriptors on your Bitcoin Core wallet and identify the derivation path for each address type.",
        "With a throwaway test mnemonic (never real funds), derive the first three m/84' addresses using a library or an offline tool.",
        "Back up a wallet's descriptors, import them into a new blank wallet with importdescriptors, and check the same addresses appear.",
      ],
    },
    {
      title: "Transactions",
      chapters: [{ n: 6, title: "Transactions", file: "ch06_transactions.adoc" }],
      extra: [{ n: 9, title: "Transaction Fees", file: "ch09_fees.adoc" }],
      opening: "Where does the balance shown in your wallet actually live?",
      summary: "The byte-by-byte anatomy of a transaction: inputs, outputs, witnesses, lock time and weight.",
      questions: [
        "Walk through the fields of a serialized transaction in order.",
        "What are the marker and flag bytes, and how do old nodes avoid being confused by segwit transactions?",
        "What is an outpoint, and why do inputs point to previous outputs instead of account balances?",
        "The fee isn't a field in the transaction. How is it worked out?",
        "What makes a coinbase transaction different from every other transaction?",
        "What are weight units and vbytes, and why does witness data count for less?",
      ],
      exercises: [
        "Decode the chapter's example transaction with decoderawtransaction and label every field by hand.",
        "On regtest, build and send a transaction with createrawtransaction, fundrawtransaction, signrawtransactionwithwallet and sendrawtransaction, then mine it.",
        "Work out your transaction's fee and fee rate from its inputs and outputs, then check it against gettransaction.",
      ],
    },
    {
      title: "Authorization and Authentication",
      chapters: [{ n: 7, title: "Authorization and Authentication", file: "ch07_authorization-authentication.adoc" }],
      opening: "If all that exists on chain is a script someone can satisfy, what does it mean to own bitcoin?",
      summary: "Bitcoin Script, multisig, P2SH, timelocks, flow control, MAST, taproot and tapscript.",
      questions: [
        "Walk through a P2PKH spend one opcode at a time. What is on the stack after each step?",
        "Script is deliberately not Turing-complete. Why is that a feature?",
        "Compare a 2-of-3 multisig as bare script, P2SH and P2WSH.",
        "What is OP_RETURN for, and why are its outputs provably unspendable?",
        "Explain OP_IF / OP_ELSE with an example such as a timelocked recovery path.",
        "What do taproot's key path and script path spends give users in privacy and cost?",
      ],
      exercises: [
        "On paper, trace a P2PKH script and write the stack after every opcode.",
        "Run a small script such as 2 3 OP_ADD 5 OP_EQUAL in a script debugger (btcdeb or an online Script IDE).",
        "On regtest, use createmultisig with three public keys and inspect the redeem script and address it returns.",
      ],
    },
    {
      title: "Digital Signatures",
      chapters: [{ n: 8, title: "Digital Signatures", file: "ch08_signatures.adoc" }],
      opening: "Why is a signature on a transaction more powerful than a password?",
      summary: "How signatures work, Schnorr and ECDSA, sighash flags, and why randomness matters.",
      questions: [
        "What three things does a digital signature prove in Bitcoin?",
        "What does a sighash flag do? Give a use case for SIGHASH_ANYONECANPAY or SIGHASH_SINGLE.",
        "How do Schnorr signatures differ from ECDSA, and what is linearity good for?",
        "Why is reusing a nonce catastrophic? Explain how it leaks the private key.",
        "What is MuSig, and how does it change what multisig looks like on chain?",
        "What problems did segwit's new signing algorithm (BIP143) fix?",
      ],
      exercises: [
        "On regtest, sign a message with signmessage and check it with verifymessage.",
        "Find the signature in a P2WPKH input's witness and split it into its DER parts (r, s) and the sighash byte.",
        "Use a library (python-bitcoinlib, bitcoinjs-lib or rust-bitcoin) to sign and verify something with a test key.",
      ],
    },
    {
      title: "The Blockchain",
      chapters: [{ n: 11, title: "The Blockchain", file: "ch11_blockchain.adoc" }],
      extra: [{ n: 10, title: "The Bitcoin Network", file: "ch10_network.adoc" }],
      opening: "Why should anyone trust the chain with the most work?",
      summary: "Block structure, headers, the genesis block, Merkle trees and Bitcoin's test networks.",
      questions: [
        "What are the fields of a block header, and what does each one commit to?",
        "Why isn't a block's own hash stored inside the block?",
        "What is special about the genesis block?",
        "How does a Merkle tree let a lightweight client prove a transaction is in a block with only a few hashes?",
        "When would you use mainnet, testnet, signet or regtest?",
        "Why isn't block height always a unique identifier for a block?",
      ],
      exercises: [
        "Fetch the genesis block with getblock <hash> 2 and decode the message hidden in its coinbase.",
        "Compute the Merkle root of a two-transaction block by hand with double SHA-256 (mind the byte order).",
        "On regtest, mine 101 blocks and explain why it takes 101 before the first coinbase reward can be spent.",
      ],
    },
    {
      title: "Mining and Consensus",
      chapters: [{ n: 12, title: "Mining and Consensus", file: "ch12_mining.adoc" }],
      opening: "Who really decides Bitcoin's rules: miners, nodes, developers or users?",
      summary: "Issuance, independent verification, proof of work, difficulty, chain selection and consensus changes.",
      questions: [
        "How is new bitcoin issued, and what enforces the 21 million limit?",
        "What does every full node check on its own before accepting a new block?",
        "How is the difficulty retarget calculated, and why every 2,016 blocks?",
        "What is Median Time Past, and why does Bitcoin need it?",
        "What can a majority-hashrate attacker do, and what can't they do?",
        "Soft fork versus hard fork: how have Bitcoin's consensus rules been changed?",
      ],
      exercises: [
        "Write a tiny proof-of-work loop that hashes a message plus a nonce until the hash starts with N zeros. Time each extra zero.",
        "Run getmininginfo and getdifficulty on signet and estimate how many hashes a block needs.",
        "Open a recent mainnet block on mempool.space and find the subsidy, the total fees and the mining pool in its coinbase.",
      ],
    },
    {
      title: "Graduation and Next Steps",
      chapters: [
        { n: 13, title: "Bitcoin Security", file: "ch13_security.adoc" },
        { n: 14, title: "Second-Layer Applications", file: "ch14_applications.adoc" },
      ],
      opening: "What is the biggest risk to your own bitcoin, and what will you change after this cohort?",
      summary: "Wrap up with security and second layers, show what you learned, and pick your next step into open source.",
      questions: [
        "What does root of trust mean for Bitcoin security?",
        "Describe a sound key backup plan for yourself. How do you spread the risk?",
        "How does a payment channel work, and what role do commitment transactions play?",
        "How do HTLCs make routed Lightning payments trustless?",
        "Which chapter changed how you think about Bitcoin the most, and why?",
        "What will you build or contribute to next?",
      ],
      exercises: [
        "Give a five-minute show-and-tell on Discord of something you built or learned during the cohort.",
        "Pick an open-source Bitcoin project (Bitcoin Core, BDK, rust-bitcoin, LDK...) and find a good first issue or a PR to review.",
        "Share your feedback on the cohort so the next one is even better.",
      ],
    },
  ],
};
