-- 011: Add difficulty, keyframe_count, candidate_count to shots table
-- Supports the keyframe strategy: S0=1kf, S1=2kf, S2=4kf
-- candidate_count (抽卡数) is separate: S0=2, S1=3, S2=4 draws per keyframe

ALTER TABLE shots
    ADD COLUMN IF NOT EXISTS difficulty TEXT NULL CHECK (difficulty IN ('S0', 'S1', 'S2')),
    ADD COLUMN IF NOT EXISTS keyframe_count INT NULL CHECK (keyframe_count IN (1, 2, 4)),
    ADD COLUMN IF NOT EXISTS candidate_count INT NULL CHECK (candidate_count BETWEEN 1 AND 6);

COMMENT ON COLUMN shots.difficulty IS '镜头难度分级: S0(静态), S1(标准), S2(复杂)';
COMMENT ON COLUMN shots.keyframe_count IS '关键帧时间锚点数: S0=1, S1=2, S2=4';
COMMENT ON COLUMN shots.candidate_count IS '每个关键帧的抽卡数: S0=2, S1=3, S2=4';
