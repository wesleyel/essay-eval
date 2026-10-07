-- 作答必须声明分类（题型之下，互不相交）与至少一个主题标签。
-- 先为已有数据增补，再用触发器在数据库层面守住约束（SQLite 无法给已有表追加 CHECK）。
-- 分类清单与 packages/domain/src/classification.ts 的 ESSAY_CATEGORIES 保持一致（有测试校验）。

-- 1) 旧的自由文本分类（如 email-reply）不再作为分类，保留为主题标签，避免信息丢失
UPDATE essays
SET tags = json_insert(tags, '$[#]', category)
WHERE category <> ''
  AND category NOT IN ('建议信', '推荐信', '邀请信', '致歉信', '申请求助信', '咨询回复', '通知', '图画·人生态度', '图画·品德情感', '图画·教育成长', '图画·文化社会', '图表·柱状图', '图表·表格', '图表·组合图')
  AND NOT EXISTS (SELECT 1 FROM json_each(essays.tags) WHERE json_each.value = essays.category);
--> statement-breakpoint

-- 2) 增补分类：按题型，并根据题目文字推断；推断不出时取默认值，可在界面里改
UPDATE essays
SET category = CASE
  WHEN type = 'part-a' THEN
    CASE
      WHEN title || ' ' || prompt LIKE '%notice%' OR title || ' ' || prompt LIKE '%announcement%' OR title || ' ' || prompt LIKE '%poster%' OR title || ' ' || prompt LIKE '%memo%' OR title || ' ' || prompt LIKE '%通知%' OR title || ' ' || prompt LIKE '%告示%' THEN '通知'
      WHEN title || ' ' || prompt LIKE '%apolog%' OR title || ' ' || prompt LIKE '%sorry%' OR title || ' ' || prompt LIKE '%致歉%' OR title || ' ' || prompt LIKE '%道歉%' THEN '致歉信'
      WHEN title || ' ' || prompt LIKE '%resign%' OR title || ' ' || prompt LIKE '%apply%' OR title || ' ' || prompt LIKE '%application%' OR title || ' ' || prompt LIKE '%辞职%' OR title || ' ' || prompt LIKE '%申请%' OR title || ' ' || prompt LIKE '%求助%' OR title || ' ' || prompt LIKE '%请求帮助%' THEN '申请求助信'
      WHEN title || ' ' || prompt LIKE '%recommend%' OR title || ' ' || prompt LIKE '%推荐%' THEN '推荐信'
      WHEN title || ' ' || prompt LIKE '%invit%' OR title || ' ' || prompt LIKE '%邀请%' THEN '邀请信'
      WHEN title || ' ' || prompt LIKE '%reply%' OR title || ' ' || prompt LIKE '%respond%' OR title || ' ' || prompt LIKE '%回复%' OR title || ' ' || prompt LIKE '%回信%' OR title || ' ' || prompt LIKE '%咨询%' THEN '咨询回复'
      ELSE '建议信'
    END
  WHEN type = 'part-b' THEN
    CASE
      WHEN (title || ' ' || prompt LIKE '%pie%' OR title || ' ' || prompt LIKE '%饼%') THEN '图表·组合图'
      WHEN title || ' ' || prompt LIKE '%table%' OR title || ' ' || prompt LIKE '%表格%' THEN '图表·表格'
      WHEN title || ' ' || prompt LIKE '%bar chart%' OR title || ' ' || prompt LIKE '%柱状%' OR title || ' ' || prompt LIKE '%chart%' OR title || ' ' || prompt LIKE '%graph%' OR title || ' ' || prompt LIKE '%figure%' OR title || ' ' || prompt LIKE '%图表%' OR title || ' ' || prompt LIKE '%折线%' THEN '图表·柱状图'
      ELSE '图画·人生态度'
    END
  ELSE ''
END;
--> statement-breakpoint

-- 3) 增补主题标签：没有任何标签的作答先归入“待归类”，方便之后在界面里补充
UPDATE essays SET tags = '["待归类"]' WHERE json_array_length(tags) = 0;
--> statement-breakpoint

-- 4) 约束：分类必须属于题型，政治无分类，且标签不能为空
CREATE TRIGGER essays_classification_insert BEFORE INSERT ON essays
WHEN NOT (
  ((NEW.type = 'part-a' AND NEW.category IN ('建议信', '推荐信', '邀请信', '致歉信', '申请求助信', '咨询回复', '通知')) OR (NEW.type = 'part-b' AND NEW.category IN ('图画·人生态度', '图画·品德情感', '图画·教育成长', '图画·文化社会', '图表·柱状图', '图表·表格', '图表·组合图')) OR (NEW.subject = 'politics' AND NEW.category = ''))
  AND json_array_length(NEW.tags) >= 1
)
BEGIN
  SELECT RAISE(ABORT, 'essays_classification: 分类需与题型匹配，且至少一个主题标签');
END;
--> statement-breakpoint
CREATE TRIGGER essays_classification_update BEFORE UPDATE OF type, category, tags ON essays
WHEN NOT (
  ((NEW.type = 'part-a' AND NEW.category IN ('建议信', '推荐信', '邀请信', '致歉信', '申请求助信', '咨询回复', '通知')) OR (NEW.type = 'part-b' AND NEW.category IN ('图画·人生态度', '图画·品德情感', '图画·教育成长', '图画·文化社会', '图表·柱状图', '图表·表格', '图表·组合图')) OR (NEW.subject = 'politics' AND NEW.category = ''))
  AND json_array_length(NEW.tags) >= 1
)
BEGIN
  SELECT RAISE(ABORT, 'essays_classification: 分类需与题型匹配，且至少一个主题标签');
END;
