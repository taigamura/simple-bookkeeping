Pod::Spec.new do |s|
  s.name = 'KajiQuickEntry'
  s.version = '1.0.0'
  s.summary = 'App Group inbox bridge for Kaji quick entry surfaces'
  s.description = 'An Expo bridge that reads quick entry drafts written into the shared App Group container.'
  s.author = 'Taiga Kimura'
  s.homepage = 'https://github.com/taigamura/simple-bookkeeping'
  s.platform = :ios, '16.4'
  s.source = { path: '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
