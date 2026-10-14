// Decoding Bitcoin study cohort: settings and curriculum.
// Lessons live on Decoding Bitcoin by The Bitcoin Dev Project (https://bitcoindevs.xyz/decoding);
// each lesson is the slug after /decoding/.
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
  courseUrl: "https://bitcoindevs.xyz/decoding",

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
      title: "Orientation and foundations",
      lessons: [
        { title: "Welcome!", slug: "welcome" },
        { title: "Bitcoin History", slug: "bitcoin-history" },
        { title: "Interactive Bitcoin Development Roadmap", slug: "interactive-roadmap" },
      ],
      extra: [{ title: "Tool: Hash Functions", slug: "hash-functions" }],
      opening: "If you had to explain Bitcoin to a friend in two sentences, what would you say, and what would you leave out?",
      summary: "Meet the cohort, learn how the dashboard works and get comfortable on Decoding Bitcoin. Read the welcome and history lessons and explore the developer roadmap.",
      questions: [
        "What problem did Bitcoin solve that earlier digital cash attempts (DigiCash, b-money, Bit Gold) could not?",
        "Pick one moment from the Bitcoin History lesson and explain why it mattered for how Bitcoin works today.",
        "What is a hash function? Name three properties Bitcoin relies on and where each one shows up.",
        "Looking at the development roadmap, which area would you most like to contribute to, and what would you need to learn first?",
        "Why do people say \"don't trust, verify\"? What can you verify yourself, and what do you usually take on trust?",
        "What makes Bitcoin hard to change? Who has to agree before a rule changes?",
      ],
      exercises: [
        "Introduce yourself in the cohort channel on Discord: your background, why you joined, and what you'd like to build.",
        "Use the Hash Functions tool: hash your name, then change one letter. How much of the output changes?",
        "Open a recent block on mempool.space, pick one transaction, and note its inputs, outputs and fee.",
      ],
    },
    {
      title: "How a transaction lives",
      lessons: [
        { title: "Transactions roadmap", slug: "roadmap" },
        { title: "Transaction Lifecycle", slug: "transaction-lifecycle" },
        { title: "UTXO vs Account Models", slug: "utxo" },
      ],
      extra: [{ title: "Tool: Reorg Calculator", slug: "reorg-calculator" }],
      opening: "When is a bitcoin payment actually final, and who gets to decide?",
      summary: "Follow a transaction from the wallet that builds it, through the mempool, into a block. Then compare Bitcoin's UTXO model with the account model other chains use.",
      questions: [
        "Walk through the lifecycle of a payment: who builds it, who relays it, who checks it, and when is it confirmed?",
        "What is the mempool? Why is there no single mempool that everyone shares?",
        "Explain the UTXO model in your own words. Why is there no account balance stored anywhere?",
        "Give one advantage and one disadvantage of UTXOs compared with an account model.",
        "What is a chain reorganisation, and why might a merchant wait for more than one confirmation?",
        "Why does change go back to the sender as a new output instead of the old output being partly spent?",
      ],
      exercises: [
        "Find a transaction on mempool.space with at least one change output. Which output do you think is the change, and why?",
        "Use the Reorg Calculator: what's the chance an attacker with 10% of the hashrate reverses a payment after 1, 3 and 6 confirmations?",
        "Watch a transaction you didn't create go from unconfirmed to 1 confirmation on mempool.space. How long did it take?",
      ],
    },
    {
      title: "Inside a transaction",
      lessons: [
        { title: "Transaction Structure", slug: "transaction-structure" },
        { title: "Technical Foundation", slug: "technical-foundation" },
      ],
      extra: [{ title: "Tool: Transaction Decoder", slug: "transaction-decoder" }],
      opening: "A transaction is just bytes. What do those bytes have to say for everyone to agree it's valid?",
      summary: "Take a raw transaction apart field by field: version, inputs, outputs, witness and locktime, plus the byte-level basics (hex, endianness, varints) you need to read it.",
      questions: [
        "List the fields of a transaction in order and say in one line what each one is for.",
        "What exactly does an input point to, and why is that enough to prove where the money came from?",
        "What is little-endian, and where does it trip people up when reading a txid?",
        "What is a compact size (varint) and why does Bitcoin use one instead of fixed-size counts?",
        "What does segwit move into the witness, and why does that fix transaction malleability?",
        "What is nLockTime for? Give a real situation where you would set it.",
      ],
      exercises: [
        "Paste a raw transaction into the Transaction Decoder and label every field by hand.",
        "Take a txid and reverse its byte order. Check on mempool.space that you've found the same transaction.",
        "Find one legacy and one segwit transaction. Compare their sizes and weights, and explain the difference.",
      ],
    },
    {
      title: "Building a transaction and paying the fee",
      lessons: [
        { title: "Creating a Transaction", slug: "transaction-creation" },
        { title: "Fee Calculation", slug: "fee-calculation" },
      ],
      opening: "Who should pay for block space, and how should they decide how much?",
      summary: "Pick inputs, create outputs and work out the fee in sats per virtual byte. See why weight units exist and how fee markets behave.",
      questions: [
        "Where is the fee written in a transaction? (Trick question: explain how it's actually found.)",
        "What are weight units and virtual bytes, and why does a witness byte count less?",
        "How does a wallet choose which UTXOs to spend? What can go wrong if it chooses badly?",
        "What is dust, and why do nodes refuse to relay dust outputs?",
        "Explain RBF and CPFP. When would you use each to speed up a stuck payment?",
        "Fees were very high in some periods and very low in others. What drives the fee market?",
      ],
      exercises: [
        "Work out the fee and the fee rate (sat/vB) of a real transaction from its inputs, outputs and vsize. Check your answer on mempool.space.",
        "Estimate the vsize of a 1-input, 2-output P2WPKH transaction, then check it against a real one.",
        "Look at mempool.space's fee estimates now and again at another time of day. What changed, and why might it have?",
      ],
    },
    {
      title: "Signing and the transaction exercises",
      lessons: [
        { title: "Signing Transactions", slug: "transaction-signing" },
        { title: "Exercises (GitHub Classroom)", slug: "transaction_exercises" },
      ],
      opening: "A signature proves something very specific. What exactly does it prove, and what doesn't it?",
      summary: "How a transaction gets signed: the sighash, what each sighash flag commits to, and why the signature goes in the input. Then work through the GitHub Classroom exercises.",
      questions: [
        "What is the sighash (the message that actually gets signed)? Why can't you just sign the whole raw transaction?",
        "Compare SIGHASH_ALL, SIGHASH_NONE and SIGHASH_SINGLE. When would anyone use ANYONECANPAY?",
        "Why does a segwit signature commit to the amount being spent, and what bug did that fix?",
        "What happens if the same nonce is used to sign two different messages with the same key?",
        "Where does the signature live in a legacy input versus a segwit input?",
        "How can a hardware wallet sign a transaction without ever showing the private key to your computer?",
      ],
      exercises: [
        "Complete the Decoding Bitcoin transaction exercises on GitHub Classroom.",
        "Pair up with someone on Discord and review each other's exercise solutions. Note one thing you'd do differently.",
        "Find a transaction that uses a sighash flag other than ALL (hint: search online for examples) and explain what it allowed.",
      ],
    },
    {
      title: "Script basics",
      lessons: [
        { title: "Scripts overview", slug: "overview" },
        { title: "P2PK: Pay To Public Key", slug: "p2pk" },
        { title: "P2PKH: Pay To Public Key Hash", slug: "p2pkh" },
      ],
      opening: "Why does Bitcoin use a tiny stack language instead of letting people write any program they like?",
      summary: "Bitcoin Script and the stack: how a locking script and an unlocking script run together, starting with the two oldest output types.",
      questions: [
        "Explain how the stack works by running OP_2 OP_3 OP_ADD OP_5 OP_EQUAL step by step.",
        "What is the difference between a scriptPubKey and a scriptSig, and in what order are they run?",
        "Why did P2PKH replace P2PK for most payments? Give at least two reasons.",
        "Run a P2PKH spend step by step: what is on the stack after each opcode?",
        "Why is Script deliberately not Turing complete, and what does it gain from that?",
        "Some opcodes were disabled early in Bitcoin's history. Why would you remove features from a running system?",
      ],
      exercises: [
        "Find a P2PK output in an early block (block 9 or 170 are good starts) and decode its script.",
        "Write out the full P2PKH stack execution for a real spend on paper, then post a photo or text version on Discord.",
        "Decode the output scripts of a recent transaction and identify each output type.",
      ],
    },
    {
      title: "P2SH and multisig",
      lessons: [
        { title: "P2SH: Pay To Script Hash (BIP 16)", slug: "p2sh" },
        { title: "P2MS: Pay To Multisig", slug: "p2ms" },
      ],
      opening: "Why might you want more than one key to move your bitcoin, and what new risks does that bring?",
      summary: "Bare multisig and why P2SH wrapped it up behind a hash, moving the cost and complexity from the sender to the receiver.",
      questions: [
        "How does P2SH move the cost and complexity of a script from the sender to the receiver?",
        "Explain the OP_CHECKMULTISIG off-by-one bug. Why has it never been fixed?",
        "Why is bare multisig (P2MS) rarely used today?",
        "What is the redeem script, and when does it finally appear on the blockchain?",
        "Compare 2-of-3 multisig with a single key plus a backup. Which risks does each protect against?",
        "BIP 16 was a soft fork. What does that mean, and how could old nodes still accept P2SH spends?",
      ],
      exercises: [
        "Do the P2MS exercises on Decoding Bitcoin, including the hard one.",
        "Find a real P2SH multisig spend and pull out the redeem script. What is M and what is N?",
        "Draw a 2-of-3 setup for a small business: who holds each key, and where is it stored?",
      ],
    },
    {
      title: "Project: build your own Bitcoin stack",
      lessons: [{ title: "Project: Build your own bitcoin Stack", slug: "project" }],
      opening: "What did you only really understand once you had to build it yourself?",
      summary: "A bigger hands-on build that brings together everything so far: implement a Bitcoin Script stack machine. Work in pairs or small groups and demo it on Monday.",
      questions: [
        "How did you represent the stack and opcodes in your code? What would you change next time?",
        "How does your stack treat true and false? Compare it with how Bitcoin Script does.",
        "Which opcode was hardest to implement, and why?",
        "How does your implementation handle a script that fails halfway through?",
        "What limits (stack size, script size, opcode count) did you add, and why does Bitcoin have them?",
        "Which test cases best convinced you that your stack is correct?",
      ],
      exercises: [
        "Build the Bitcoin stack project. Push your code to GitHub and share the link on Discord.",
        "Run a P2PKH script (with dummy keys) through your stack and show each step.",
        "Review another group's project and leave them one helpful comment.",
      ],
    },
    {
      title: "Taproot: keys and Schnorr",
      lessons: [
        { title: "Introduction to Taproot", slug: "introduction-taproot" },
        { title: "Pay to Taproot", slug: "p2tr" },
        { title: "Schnorr & BIP340", slug: "schnorr-bip340" },
        { title: "Key-path Taproot", slug: "key-path-taproot" },
      ],
      opening: "Taproot makes many different spending setups look the same on-chain. Why is that good for everyone?",
      summary: "Why Taproot happened, how a P2TR output is built, what Schnorr signatures add, and the simple case: spending with a single key.",
      questions: [
        "What problems was Taproot designed to solve for privacy, efficiency and flexibility?",
        "What is a tweaked public key, and why does P2TR use x-only (32-byte) keys?",
        "Compare Schnorr and ECDSA. What does linearity allow you to do?",
        "What is key aggregation (MuSig), and why does it make multisig look like a single-key spend?",
        "Walk through a key-path spend: what is in the witness, and what does a node check?",
        "Why did Taproot addresses need bech32m instead of bech32?",
      ],
      exercises: [
        "Find a P2TR key-path spend on mempool.space and compare its witness with a P2WPKH spend.",
        "Decode a bc1p address: what witness version and program does it contain?",
        "Explain the taproot tweak to someone in the cohort without using any maths. Post your explanation on Discord.",
      ],
    },
    {
      title: "Taproot scripts and graduation",
      lessons: [
        { title: "Script-path Taproot", slug: "script-path-taproot" },
        { title: "Taproot Signatures", slug: "taproot-signatures" },
        { title: "Capstone: Build & Spend a P2TR", slug: "build-spend-p2tr" },
      ],
      opening: "Now that you can build and spend a Taproot output, what would you like to build next?",
      summary: "Script trees, control blocks and the Taproot sighash. Finish the capstone, share what you built, and plan your next step into Bitcoin open source.",
      questions: [
        "What is a tapleaf and a tapbranch? How do they combine into the Merkle root?",
        "What is in a control block, and what does it prove?",
        "Why does a script-path spend only reveal the one script that was used?",
        "What changed in the Taproot sighash (BIP341) compared with segwit v0?",
        "Design a script tree for an inheritance wallet. What goes in the key path, and what goes in each leaf?",
        "What's your next step after this cohort: a Code Orange program, a project to contribute to, or a review club?",
      ],
      exercises: [
        "Complete the capstone: build and spend a P2TR output on regtest or signet.",
        "Present your capstone (or one exercise you're proud of) in 3 minutes at the final session.",
        "Share your feedback on the cohort so the next one is even better.",
      ],
    },
  ],
};
