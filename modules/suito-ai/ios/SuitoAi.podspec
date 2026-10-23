Pod::Spec.new do |s|
  s.name           = 'SuitoAi'
  s.version        = '1.0.0'
  s.summary        = 'Suito AI: on-device Foundation Models, speech, receipt OCR, Siri snapshot/inbox files, Spotlight'
  s.description    = s.summary
  s.license        = { :type => 'Proprietary' }
  s.author         = 'Taiga Kimura'
  s.homepage       = 'https://github.com/taigamura/simple-bookkeeping'
  s.platforms      = { :ios => '26.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FoundationModels', 'CoreSpotlight', 'UniformTypeIdentifiers', 'Speech', 'AVFoundation', 'Vision', 'VisionKit', 'UIKit'

  s.source_files = '**/*.{h,m,swift}'
  # DEFINES_MODULE: the App Intents compiled into the app target `import SuitoAi` for SuitoSiriStore.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
