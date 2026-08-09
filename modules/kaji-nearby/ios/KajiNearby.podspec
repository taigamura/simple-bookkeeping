Pod::Spec.new do |s|
  s.name           = 'KajiNearby'
  s.version        = '1.0.0'
  s.summary        = 'Foreground nearby household synchronization for iOS'
  s.description    = 'An Expo bridge to Apple MultipeerConnectivity with encrypted MCSession traffic.'
  s.author         = 'Taiga Kimura'
  s.homepage       = 'https://github.com/taigamura/simple-bookkeeping'
  s.platform       = :ios, '16.4'
  s.source         = { path: '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
