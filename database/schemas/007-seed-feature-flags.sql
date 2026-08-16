-- Default feature flags for the admin settings page (idempotent)
INSERT INTO feature_flags (key, description, scope, enabled, conditions) VALUES
  ('enable_rag_v2', 'محرك الاسترجاع المعزز الجديد مع إعادة الترتيب', 'global', TRUE, '{"category": "AI", "rollout": 100, "label": "RAG v2 Engine"}'),
  ('enable_streaming', 'البث المباشر للردود بدلاً من الرد الكامل', 'global', TRUE, '{"category": "AI", "rollout": 100, "label": "Streaming Responses"}'),
  ('enable_voice', 'إدخال صوتي في ويدجت الدردشة', 'global', FALSE, '{"category": "ويدجت", "rollout": 0, "label": "Voice Input"}'),
  ('enable_multilingual', 'كشف لغة الزائر والرد بنفس اللغة تلقائياً', 'global', TRUE, '{"category": "AI", "rollout": 85, "label": "Multi-language Auto-detect"}'),
  ('enable_analytics_v3', 'لوحة تحليلات متقدمة مع تتبع الأحداث', 'global', TRUE, '{"category": "تحليلات", "rollout": 50, "label": "Analytics v3 Dashboard"}'),
  ('enable_sso_saml', 'تسجيل دخول موحد عبر SAML 2.0', 'global', TRUE, '{"category": "أمان", "rollout": 100, "label": "SSO/SAML Support"}'),
  ('enable_custom_models', 'السماح للمشتركين بتدريب نماذج مخصصة', 'global', FALSE, '{"category": "AI", "rollout": 0, "label": "Custom Model Fine-tuning"}'),
  ('enable_api_v3', 'نقاط النهاية الجديدة للإصدار الثالث من API', 'global', TRUE, '{"category": "API", "rollout": 30, "label": "API v3 Endpoints"}'),
  ('maintenance_mode', 'وضع الصيانة — يعرض رسالة صيانة لجميع المشتركين', 'global', FALSE, '{"category": "نظام", "rollout": 0, "label": "Maintenance Mode"}')
ON CONFLICT (key) DO NOTHING;
