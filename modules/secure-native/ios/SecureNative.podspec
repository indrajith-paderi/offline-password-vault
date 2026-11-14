Pod::Spec.new do |s|
  s.name           = 'SecureNative'
  s.version        = '1.0.0'
  s.summary        = 'Hardware-bound keys, platform AES-GCM, sensitive clipboard and integrity checks'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'Offline Vault'
  s.homepage       = 'https://example.invalid'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
