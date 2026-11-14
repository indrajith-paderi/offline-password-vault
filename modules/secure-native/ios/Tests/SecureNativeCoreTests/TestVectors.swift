struct GcmVector {
  let name: String
  let key: String
  let nonce: String
  let aad: String
  let plaintext: String
  let ciphertext: String
  let tag: String
}

enum TestVectors {
  static let gcm: [GcmVector] = [
    GcmVector(name: "tc13", key: "0000000000000000000000000000000000000000000000000000000000000000", nonce: "000000000000000000000000", aad: "", plaintext: "", ciphertext: "", tag: "530f8afbc74536b9a963b4f1c4cb738b"),
    GcmVector(name: "tc14", key: "0000000000000000000000000000000000000000000000000000000000000000", nonce: "000000000000000000000000", aad: "", plaintext: "00000000000000000000000000000000", ciphertext: "cea7403d4d606b6e074ec5d3baf39d18", tag: "d0d1c8a799996bf0265b98b5d48ab919"),
    GcmVector(name: "tc15", key: "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308", nonce: "cafebabefacedbaddecaf888", aad: "", plaintext: "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255", ciphertext: "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015ad", tag: "b094dac5d93471bdec1a502270e3cc6c"),
    GcmVector(name: "tc16", key: "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308", nonce: "cafebabefacedbaddecaf888", aad: "feedfacedeadbeeffeedfacedeadbeefabaddad2", plaintext: "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39", ciphertext: "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662", tag: "76fc6ece0f4e1768cddf8853bb2d551b"),
  ]
}
