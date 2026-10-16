// Decoding Bitcoin practice quizzes: 4 questions per week, plus a 10-question knowledge check
// taken at the start and again at the end (one question from each week) to measure what was learned.
// Each question: q, options, answer (index of the right option), why (shown after answering).
// Bump the ?v= on its <script> tag in decoding-bitcoin/me.html after editing.
window.MB_QUIZ = {
  weeks: [
    [
      { q: "You hash a word with SHA-256, then change one letter and hash it again. What happens to the output?", options: ["Only the last few characters change", "Roughly half the bits change, in a way you can't predict", "Nothing changes, the hash only depends on length", "The output gets one character longer"], answer: 1, why: "That's the avalanche effect: a tiny change in the input scrambles the whole output. It's why a hash works as a fingerprint." },
      { q: "How long is a SHA-256 hash?", options: ["160 bits (20 bytes)", "256 bits (32 bytes)", "512 bits (64 bytes)", "It depends on the input"], answer: 1, why: "SHA-256 always outputs 256 bits, 64 hex characters, whatever the size of the input." },
      { q: "When was the Bitcoin whitepaper published?", options: ["2006", "2008", "2009", "2011"], answer: 1, why: "Satoshi published it on 31 October 2008. The genesis block followed on 3 January 2009." },
      { q: "What does \"don't trust, verify\" mean in practice?", options: ["Only use exchanges with good reviews", "Run your own node so you check every rule yourself", "Ask several friends before sending bitcoin", "Read the whitepaper once a year"], answer: 1, why: "A full node checks every block and transaction against the rules, so you don't have to trust anyone else's word about your coins." },
    ],
    [
      { q: "What is a UTXO?", options: ["An account balance stored by the network", "An unspent transaction output that has to be spent in full", "A block that hasn't been mined yet", "A type of Bitcoin address"], answer: 1, why: "Your \"balance\" is the sum of UTXOs your keys can spend. Each one is consumed whole when it's used as an input." },
      { q: "You have a single 0.5 BTC UTXO and want to pay someone 0.2 BTC. What does your wallet do?", options: ["Sends 0.2 BTC and the network keeps the rest", "Creates a 0.2 BTC output to them and a change output of about 0.3 BTC (minus the fee) back to you", "Splits the UTXO on-chain before paying", "Waits until you have a UTXO of exactly 0.2 BTC"], answer: 1, why: "UTXOs can't be partly spent, so the leftover comes back as change. Anything not assigned to an output becomes the fee." },
      { q: "Where does a valid transaction wait before it's mined?", options: ["In the blockchain", "In the mempool of each node", "In the sender's wallet only", "On a central Bitcoin server"], answer: 1, why: "Nodes keep unconfirmed transactions in their mempool, and miners pick from it (usually highest fee rate first)." },
      { q: "Why do people wait for several confirmations on big payments?", options: ["Each new block makes reversing the payment much harder", "The receiver can't see the coins until then", "Fees are refunded after 6 confirmations", "The transaction is encrypted until then"], answer: 0, why: "To reverse a payment, an attacker must out-mine everyone else from that block onwards. The odds of that drop fast with every block on top." },
    ],
    [
      { q: "What is the first field of a serialized transaction?", options: ["The inputs", "The version", "The locktime", "The txid"], answer: 1, why: "A transaction starts with a 4-byte version, then (for segwit) a marker and flag, the inputs, the outputs, the witness and finally the locktime." },
      { q: "Why does a txid on a block explorer look different from the bytes you hash?", options: ["Explorers encrypt it", "It's shown in reversed byte order", "Explorers use a different hash function", "It includes the block height"], answer: 1, why: "The double-SHA256 is displayed byte-reversed by convention. That's why exercise 2 has you flip the bytes." },
      { q: "Is the witness data part of what's hashed to make the txid?", options: ["Yes, always", "No, and that's what fixed transaction malleability", "Only for legacy transactions", "Only the signatures, not the public keys"], answer: 1, why: "SegWit moved signatures into the witness and left them out of the txid, so nobody can change a txid by tweaking a signature." },
      { q: "What is a CompactSize (varint) used for in a transaction?", options: ["Storing amounts in satoshis", "Lengths and counts, like how many inputs there are", "The version number", "The signature itself"], answer: 1, why: "Counts and script lengths use a variable-length integer so small numbers take just one byte." },
    ],
    [
      { q: "How do you work out a transaction's fee?", options: ["It's written in a fee field", "Total inputs minus total outputs", "Size in bytes times 1 sat", "The miner picks it after mining"], answer: 1, why: "There's no fee field. Whatever input value isn't assigned to an output goes to the miner." },
      { q: "Which unit do fee rates normally use?", options: ["BTC per transaction", "sats per virtual byte (sat/vB)", "sats per input", "USD per kilobyte"], answer: 1, why: "Block space is limited by weight, so fees are compared per virtual byte, not per transaction." },
      { q: "How many weight units is one virtual byte?", options: ["1", "2", "4", "8"], answer: 2, why: "Blocks hold up to 4 million weight units. vsize = weight / 4, rounded up." },
      { q: "Why are witness bytes cheaper than other bytes?", options: ["They're compressed", "Each witness byte counts as 1 weight unit instead of 4", "Miners don't download them", "They're stored off-chain"], answer: 1, why: "The SegWit discount makes witness data a quarter of the cost, which makes spending segwit outputs cheaper." },
    ],
    [
      { q: "What does a SIGHASH_ALL signature commit to?", options: ["Only its own input", "All inputs and all outputs", "Only the outputs", "Only the amount"], answer: 1, why: "SIGHASH_ALL is the default for legacy and segwit v0: change any input or output and the signature breaks." },
      { q: "What does adding ANYONECANPAY to a sighash flag allow?", options: ["Anyone can spend the coins", "Others can add more inputs without breaking your signature", "The fee can be changed by the miner", "The signature works on any transaction"], answer: 1, why: "With ANYONECANPAY you only sign your own input, so others can add theirs, as in crowdfunding-style transactions." },
      { q: "What exactly gets signed?", options: ["The txid of the previous transaction", "A hash of the transaction, prepared according to the sighash flag (the sighash)", "The whole block", "The private key"], answer: 1, why: "The signer builds a specific message from the transaction (the sighash) and signs that. The flag decides which parts it covers." },
      { q: "In a P2WPKH spend, where do the signature and public key go?", options: ["In the scriptSig", "In the witness", "In the output", "In the locktime"], answer: 1, why: "For native segwit the scriptSig is empty and the signature and public key sit in the witness." },
    ],
    [
      { q: "How does Bitcoin Script run?", options: ["Line by line like Python, with loops", "On a stack, and it's deliberately not Turing-complete", "Inside a virtual machine with accounts", "Only on miners' computers"], answer: 1, why: "Script is a simple stack language with no loops, so every script finishes and its cost is predictable." },
      { q: "Which is a P2PKH locking script?", options: ["<pubkey> OP_CHECKSIG", "OP_DUP OP_HASH160 <pubkey hash> OP_EQUALVERIFY OP_CHECKSIG", "OP_HASH160 <script hash> OP_EQUAL", "OP_1 <32-byte key>"], answer: 1, why: "The first is P2PK, the third P2SH and the fourth P2TR." },
      { q: "What does the spender provide to unlock a P2PKH output?", options: ["The private key", "A signature and the public key", "Just the public key hash", "The redeem script"], answer: 1, why: "The public key must hash to the pubkey hash in the output, and the signature must be valid for that key." },
      { q: "When is a spend valid?", options: ["When the script runs without failing and leaves true (non-zero) on top of the stack", "When the stack ends empty", "When the miner approves it", "When the fee is high enough"], answer: 0, why: "Script fails on any failed VERIFY, and at the end the top stack item must be true." },
    ],
    [
      { q: "In P2SH, who provides the redeem script?", options: ["The sender, when paying", "The spender, when spending", "The miner", "Nobody, it's stored on-chain in the output"], answer: 1, why: "The output only holds a hash. The spender reveals the full script when spending, so the sender never needs to know it." },
      { q: "Why do OP_CHECKMULTISIG spends start with an extra OP_0?", options: ["To set the fee", "An old off-by-one bug pops one extra item from the stack", "It marks the transaction as segwit", "It's the number of signatures"], answer: 1, why: "The bug is consensus now, so everyone pushes a dummy element for it to pop." },
      { q: "What do mainnet P2SH addresses start with?", options: ["1", "3", "bc1q", "bc1p"], answer: 1, why: "1 is P2PKH, 3 is P2SH, bc1q is segwit v0 and bc1p is Taproot." },
      { q: "What's the main advantage of P2SH over bare multisig?", options: ["Smaller signatures", "The sender pays to a short hash and the receiver carries the size and cost of the script", "No fees", "It hides the amount"], answer: 1, why: "Bare multisig puts all the keys in the output. P2SH hides them behind a 20-byte hash until spend time." },
    ],
    [
      { q: "What does OP_DUP do?", options: ["Removes the top item", "Copies the top item and pushes the copy", "Swaps the top two items", "Duplicates the whole stack"], answer: 1, why: "In P2PKH it copies the public key so one copy can be hashed and the other used for OP_CHECKSIG." },
      { q: "What does OP_EQUALVERIFY do?", options: ["Pushes true or false", "Compares the top two items and fails the script if they differ, removing both", "Checks a signature", "Hashes the top item"], answer: 1, why: "It's OP_EQUAL followed by OP_VERIFY: equal means carry on with both removed, not equal means stop." },
      { q: "In which order do the scripts run for a legacy spend?", options: ["Locking script first, then unlocking script", "Unlocking script (scriptSig) first, then the locking script (scriptPubKey) on the same stack", "Both at the same time", "Only the locking script runs"], answer: 1, why: "The scriptSig pushes the signature and key, then the scriptPubKey runs against that stack." },
      { q: "What is OP_HASH160?", options: ["SHA-256 twice", "RIPEMD-160 of the SHA-256", "A 160-bit random number", "SHA-1"], answer: 1, why: "HASH160 = RIPEMD160(SHA256(x)), which gives the 20-byte hashes in P2PKH and P2SH." },
    ],
    [
      { q: "When did Taproot activate on mainnet?", options: ["2017", "2019", "November 2021", "2024"], answer: 2, why: "Taproot activated at block 709,632 in November 2021, after the Speedy Trial signalling." },
      { q: "How big is a BIP340 Schnorr signature?", options: ["32 bytes", "64 bytes", "71 to 73 bytes", "It varies"], answer: 1, why: "A fixed 64 bytes, a bit smaller than DER-encoded ECDSA signatures (about 71 to 72 bytes)." },
      { q: "What do mainnet Taproot (P2TR) addresses start with?", options: ["bc1q", "bc1p", "3", "tb1q"], answer: 1, why: "bc1p means witness version 1. bc1q is version 0 (P2WPKH and P2WSH)." },
      { q: "What's in the witness of a key-path Taproot spend?", options: ["A signature and a public key", "Just one Schnorr signature", "The script tree", "A redeem script"], answer: 1, why: "The output already contains the (tweaked) key, so a single signature is enough, and it looks like any other single-key spend." },
    ],
    [
      { q: "What does a script-path Taproot spend reveal?", options: ["Every script in the tree", "Only the script used, plus a control block proving it's in the tree", "Nothing at all", "The private key"], answer: 1, why: "The other branches stay hidden. That's the privacy and size win of MAST." },
      { q: "What's in the control block?", options: ["The fee and locktime", "The internal key (with parity and leaf version) and the Merkle path to the script", "All the signatures", "The txid"], answer: 1, why: "It lets the verifier rebuild the output key from the internal key and the script's Merkle path." },
      { q: "What's special about SIGHASH_DEFAULT in Taproot?", options: ["It signs nothing", "It acts like SIGHASH_ALL but saves a byte by leaving the flag out", "It's only for multisig", "It lets anyone change the outputs"], answer: 1, why: "A 64-byte signature means DEFAULT; a 65th byte is only added for other flags." },
      { q: "Why do Taproot outputs use 32-byte x-only public keys?", options: ["They're encrypted", "BIP340 drops the y-coordinate's parity byte to save space", "They're hashes, not keys", "To support quantum resistance"], answer: 1, why: "Schnorr in BIP340 uses x-only keys, so P2TR outputs carry a 32-byte key instead of a 33-byte compressed one." },
    ],
  ],
  // The knowledge check: [week index, question index], one per week. Taken before week 1 and again from week 9.
  check: [[0, 0], [1, 1], [2, 2], [3, 2], [4, 0], [5, 2], [6, 0], [7, 3], [8, 3], [9, 0]],
};
