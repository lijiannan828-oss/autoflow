# Autoflow ER 关系图

```mermaid
erDiagram
  projects ||--o{ series : has
  series ||--o{ episodes : has
  episodes ||--o{ stage_tasks : has
  users ||--o{ stage_tasks : locks_or_assigned
  users ||--o{ partner_scopes : has
  series ||--o{ partner_scopes : grants
  episodes ||--o{ partner_scopes : optional_scope

  series ||--o{ assets : has
  episodes ||--o{ assets : optional_scope
  episodes ||--o{ shots : has
  assets ||--o{ variants : has
  shots ||--o{ variants : has
  episode_versions ||--o{ variants : has_version_outputs
  variants ||--o{ character_voice_bindings : bound_voice
  series ||--o{ character_voice_bindings : has

  episodes ||--o{ episode_versions : has
  episode_versions ||--o{ timelines : has
  timelines ||--o{ timeline_tracks : has
  timeline_tracks ||--o{ timeline_clips : has
  variants ||--o{ timeline_clips : source

  episodes ||--o{ review_points : has
  episodes ||--o{ model_jobs : has
  episode_versions ||--o{ review_points : in_version
  users ||--o{ review_points : created_by

  episodes ||--o{ review_decision_records : has
  episode_versions ||--o{ review_decision_records : in_version
  users ||--o{ review_decision_records : created_by
  review_decision_records ||--o{ review_decision_points : maps
  review_points ||--o{ review_decision_points : maps

  episodes ||--o{ revision_logs : has
  episode_versions ||--o{ revision_logs : in_version
  review_decision_records ||--o{ revision_logs : triggers
  model_jobs ||--o{ revision_logs : source_job
  model_jobs ||--o{ variants : source_job

  episodes ||--o{ feedback_records : has
  users ||--o{ feedback_records : created_by

  users ||--o{ audit_logs : actor
  series ||--o{ event_metrics : optional
  episodes ||--o{ event_metrics : optional
  stage_tasks ||--o{ event_metrics : optional
  users ||--o{ event_metrics : optional
```

## 说明

- `episodes.current_version_id` 指向 `episode_versions.id`。
- `assets.selected_variant_id`、`shots.default_*_variant_id` 指向 `variants.id`。
- `variants.episode_version_id` 可用于挂载整集级产物（如 `final_cut`）。
- `stage_tasks` 使用部分唯一索引，确保每个 `(episode_id, stage_no)` 只有一个活跃任务。
