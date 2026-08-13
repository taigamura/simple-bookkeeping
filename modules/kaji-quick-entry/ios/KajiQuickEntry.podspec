Pod::Spec.new do |s|
  s.name = 'KajiQuickEntry'
  s.version = '1.0.0'
  s.summary = 'App Group inbox bridge for Kaji quick entry surfaces'
  s.platform = :ios, '16.4'
  s.source = { path: '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
