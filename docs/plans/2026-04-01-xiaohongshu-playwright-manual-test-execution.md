# xiaohongshu-playwright Skill 测试执行计划

> **For Agent:** 本文档是可直接执行的测试脚本，按顺序完成每个阶段，记录每步结果。  
> **版本：** 2026-04-01  
> **前置要求：** macOS，Node.js 22+，当前工作目录可读写，允许打开浏览器  
> **测试账号：** 需要一套可登录小红书 PC Web 的测试账号（手机可扫码）

---

## 路径变量（全文通用）

```bash
SKILL_DIR="/Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright"
DATA_DIR="$SKILL_DIR/data"
OUTPUT_DIR="$SKILL_DIR/output"
REF_FILE="$SKILL_DIR/references/site-patterns/xiaohongshu.md"
```

---

## 阶段 0：全量清理（每次测试开始前必须执行）

```bash
cd "$SKILL_DIR"

# 清理测试关键词遗留数据
rm -f "$DATA_DIR/comments_医美.json"
rm -f "$DATA_DIR/candidates_医美.json"
rm -f "$DATA_DIR/analysis_医美.json"
rm -rf "$DATA_DIR/analysis_posts/医美"
rm -rf "$DATA_DIR/task-specs/"
mkdir -p "$DATA_DIR/task-specs" "$DATA_DIR/screenshots" "$OUTPUT_DIR"

# 验证清理成功
ls "$DATA_DIR/" | grep -E "医美" && echo "⚠ 清理不彻底" || echo "✅ 数据目录已清空"
```

**预期：** 输出 `✅ 数据目录已清空`

---

## 阶段 1：自动化测试套件（无需浏览器）

### Step 1.1 运行全部自动化测试

```bash
cd "$SKILL_DIR"
npm test
```

**预期输出（关键行）：**
```
=== save-task-spec.js 测试 ===
  ✓ TC-SPEC-001 生成合法 task spec
  ...
Passed: 8, Failed: 0

=== filter-comments.js 测试 ===
  ✓ TC-FILTER-001 正常粗筛输出完整结构
  ✓ TC-FILTER-005 标题含 exclude 词的帖子应进入 skippedPosts
  ...
Passed: 9, Failed: 0

=== merge-analysis.js 测试 ===
  ...
Passed: 7, Failed: 0

=== generate-excel.js 测试 ===
  ...
Passed: 7, Failed: 0

=== cleanup-task-specs.js 测试 ===
  ...
Passed: 3, Failed: 0

总计：34 通过，0 失败
```

**判定：**
- ✅ 通过：总计 `Failed: 0`
- ❌ 失败：记录哪个测试文件、哪条用例失败，以及错误信息

**若自动化测试有失败，先停止，记录后进入下一阶段。不要跳过。**

---

## 阶段 2：环境检测（bootstrap-playwright.js）

### Step 2.1 验证环境已就绪

```bash
cd "$SKILL_DIR"
node scripts/bootstrap-playwright.js
echo "EXIT: $?"
```

**预期：**
- 退出码为 `0`
- stdout 含 `已就绪` 或 `已安装` 或 `环境初始化完成`

**判定：**
- ✅ 通过：exit 0，含就绪信息
- ❌ 失败：exit 非 0，记录 stderr

### Step 2.2 验证采集脚本缺少 task-spec 时报错

```bash
cd "$SKILL_DIR"
node scripts/xhs-scraper.js \
  --keyword "医美" \
  --output "$DATA_DIR/comments_医美.json" \
  2>&1; echo "EXIT: $?"
```

**预期：**
- 退出码非 0
- stderr 含 `必须传入 --task-spec` 或类似提示

---

## 阶段 3：task spec 生成（save-task-spec.js）

### Step 3.1 生成合法 task spec

```bash
cd "$SKILL_DIR"
TASK_SPEC_PATH=$(node scripts/save-task-spec.js \
  --keyword "医美" \
  --json '{
    "keyword":"医美",
    "post_relevance":{
      "include":["医美","热玛吉","超声刀"],
      "exclude":["避雷","翻车","踩坑"]
    },
    "comment_filter":{
      "include":["多少钱","想做","求推荐","哪里做","效果怎么样"],
      "exclude":["加我","合作","招聘","我是做"]
    },
    "semantic_focus":"只保留明确购买意向或主动咨询的用户，排除营销、广告、无意义互动"
  }')
echo "TASK_SPEC_PATH=$TASK_SPEC_PATH"
```

**预期：**
- `TASK_SPEC_PATH` 输出一个绝对路径
- 路径存在：`ls -la "$TASK_SPEC_PATH"`
- 文件名格式：`<timestamp>_医美.json`

**验证文件内容：**
```bash
cat "$TASK_SPEC_PATH" | python3 -m json.tool | head -20
```

**预期：** JSON 合法，含 `keyword`、`post_relevance`、`comment_filter`、`semantic_focus` 字段

### Step 3.2 错误场景验证

```bash
# 缺少 --keyword
node scripts/save-task-spec.js --json '{"keyword":"x"}' 2>&1; echo "EXIT: $?"

# 非法 JSON
node scripts/save-task-spec.js --keyword "测试" --json '{invalid}' 2>&1; echo "EXIT: $?"
```

**预期：** 两条命令退出码均非 0，stderr 有明确错误提示

---

## 阶段 4：数据采集（xhs-scraper.js，需要真实浏览器 + 账号）

> ⚠ **重要约定**：
> - 脚本打开浏览器等待登录时，等待窗口为 **5 分钟**，不得在窗口内主动中断
> - 如果测试账号已有有效 cookie，可跳过登录等待直接采集
> - 若 5 分钟内未完成登录，脚本自行超时退出，记录为"登录超时"而非"脚本失败"

### Step 4.1 清理旧 cookie（可选，用于测试登录流程）

```bash
# 仅当需要测试登录流程时执行，否则跳过
mv "$DATA_DIR/cookies.json" "$DATA_DIR/cookies.json.bak" 2>/dev/null || true
```

### Step 4.2 运行采集脚本

```bash
cd "$SKILL_DIR"

# 确保使用上一步生成的 TASK_SPEC_PATH，如果变量已丢失则重新获取：
TASK_SPEC_PATH=$(ls "$DATA_DIR/task-specs/"*_医美.json 2>/dev/null | head -1)
echo "使用 task spec: $TASK_SPEC_PATH"

node scripts/xhs-scraper.js \
  --keyword "医美" \
  --task-spec "$TASK_SPEC_PATH" \
  --max-posts 3 \
  --max-comments 30 \
  --speed slow \
  --headed \
  --cookie-path "$DATA_DIR/cookies.json" \
  --output "$DATA_DIR/comments_医美.json"

echo "EXIT: $?"
```

**人工协助步骤：**
- 如果脚本提示 `请在浏览器窗口中完成登录`：在浏览器中手动完成小红书登录
- 如果脚本提示 `搜索页检测到登录弹窗`：在弹窗中补充登录

**预期结果：**
```
EXIT: 0
```

**验证产物：**
```bash
# 检查 comments 文件存在且合法
ls -la "$DATA_DIR/comments_医美.json"
python3 -c "import json; d=json.load(open('$DATA_DIR/comments_医美.json')); print(f'帖子数: {len(d[\"posts\"])}')"

# 检查截图
ls "$DATA_DIR/screenshots/" | head -5
echo "截图数量: $(ls "$DATA_DIR/screenshots/" | wc -l)"
```

**预期：**
- `comments_医美.json` 存在
- `帖子数` ≥ 1（最多 3）
- `截图数量` ≥ 1

---

## 阶段 5：粗筛（filter-comments.js）

### Step 5.1 运行粗筛

```bash
cd "$SKILL_DIR"

node scripts/filter-comments.js \
  --input "$DATA_DIR/comments_医美.json" \
  --output "$DATA_DIR/candidates_医美.json" \
  --task-spec "$TASK_SPEC_PATH"

echo "EXIT: $?"
```

**预期：**
```
✅ 粗筛完成
EXIT: 0
```

### Step 5.2 验证粗筛结果

```bash
python3 -c "
import json
d = json.load(open('$DATA_DIR/candidates_医美.json'))
print('keyword:', d.get('keyword'))
print('taskSpecPath 存在:', bool(d.get('taskSpecPath')))
print('taskSpec 存在:', bool(d.get('taskSpec')))
print('posts 数:', len(d.get('posts', [])))
print('skippedPosts 数:', len(d.get('skippedPosts', [])))
s = d.get('stats', {})
print('stats.totalPosts:', s.get('totalPosts'))
print('stats.keptPosts:', s.get('keptPosts'))
print('stats.filterReasons:', s.get('filterReasons'))
"
```

**预期：**
- `keyword` = `医美`
- `taskSpecPath` 和 `taskSpec` 均存在
- `posts` 为列表（0 或以上条目）
- `stats.filterReasons` 存在（即使值为空字典）

### Step 5.3 噪声过滤验收（抽查）

```bash
python3 -c "
import json
d = json.load(open('$DATA_DIR/candidates_医美.json'))
all_comments = [c for p in d['posts'] for c in p.get('comments', [])]
print(f'保留评论总数: {len(all_comments)}')
# 抽查前 3 条内容
for c in all_comments[:3]:
    print(f'  - {c[\"username\"]}: {c[\"content\"][:50]}')
"
```

**人工确认：** 抽查评论中不应出现：
- 纯表情（如 `😍😍😍`）
- 广告引流（如 `加我微信`、`招聘`）
- 无实质内容的 `@` 引用

---

## 阶段 6：精筛分析（需要 sub-agent 支持，串行降级模式可跳过分片）

> 此阶段通常由 Claude skill 触发，在 OpenClaw/sub-agent 环境执行。  
> 若测试环境不支持 sub-agent，直接使用下方串行降级命令模拟。

### Step 6.1 为每帖创建分析分片（模拟并行精筛输出）

```bash
cd "$SKILL_DIR"

# 创建 analysis_posts 目录
mkdir -p "$DATA_DIR/analysis_posts/医美"

# 从 candidates 提取帖子列表，为每帖创建模拟分片
python3 -c "
import json, os, pathlib

candidates_path = '$DATA_DIR/candidates_医美.json'
out_dir = '$DATA_DIR/analysis_posts/医美'
pathlib.Path(out_dir).mkdir(parents=True, exist_ok=True)

d = json.load(open(candidates_path))
for post in d.get('posts', []):
    note_id = post.get('noteId', '')
    if not note_id:
        continue
    # 从 candidates 的评论构建模拟分析分片
    valid_comments = []
    for c in post.get('comments', []):
        valid_comments.append({
            'username': c.get('username', ''),
            'userId': c.get('userId', ''),
            'content': c.get('content', ''),
            'ipLocation': c.get('ipLocation', ''),
            'interestTags': '购买意向',
            'interestScore': 7,
            'reason': '粗筛命中，语义分析待补充',
            'profileUrl': c.get('profileUrl', '')
        })
    shard = {
        'postId': note_id,
        'title': post.get('title', ''),
        'url': post.get('url', ''),
        'screenshotFile': post.get('screenshotFile', None),
        'totalComments': post.get('commentCount', 0),
        'collectedComments': len(post.get('comments', [])),
        'validComments': valid_comments
    }
    out_path = os.path.join(out_dir, f'{note_id}.json')
    json.dump(shard, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'  写入: {out_path}')
print(f'共写入 {len(d.get(\"posts\", []))} 个分片')
"
```

> **注意：** 若由真实 Claude sub-agent 执行精筛，跳过 Step 6.1，直接进入 Step 6.2。

### Step 6.2 运行合并脚本（merge-analysis.js）

```bash
cd "$SKILL_DIR"

node scripts/merge-analysis.js \
  --keyword "医美" \
  --candidates "$DATA_DIR/candidates_医美.json" \
  --posts-dir "$DATA_DIR/analysis_posts/医美" \
  --output "$DATA_DIR/analysis_医美.json"

echo "EXIT: $?"
```

**预期：**
- stdout 含 `合并统计` 或类似信息
- `EXIT: 0`

**验证：**
```bash
python3 -c "
import json
d = json.load(open('$DATA_DIR/analysis_医美.json'))
print('posts 数:', len(d.get('posts', [])))
for p in d['posts']:
    print(f'  帖子: {p[\"title\"][:30]}，有效评论数: {len(p.get(\"validComments\", []))}')
"
```

---

## 阶段 7：Excel 导出（generate-excel.js）

### Step 7.1 导出 Excel

```bash
cd "$SKILL_DIR"

node scripts/generate-excel.js \
  --input "$DATA_DIR/analysis_医美.json"

echo "EXIT: $?"
```

**预期：**
```
✅ Excel 已生成: /.../.../output/医美_<YYYYMMDD>_<HH-mm>.xlsx
   帖子: X
   用户行: X
   嵌入截图: X 张
EXIT: 0
```

**验证文件：**
```bash
XLSX_FILE=$(ls "$OUTPUT_DIR/医美_"*.xlsx 2>/dev/null | head -1)
echo "生成文件: $XLSX_FILE"
ls -la "$XLSX_FILE"
```

**预期：** xlsx 文件存在，大小 > 0

### Step 7.2 用 Node.js 验证 Excel 结构（16 列）

```bash
node -e "
const path = require('path');
const ExcelJS = require(path.join('$SKILL_DIR', 'node_modules', 'exceljs'));
const wb = new ExcelJS.Workbook();
const xlsxFile = require('child_process').execSync('ls $OUTPUT_DIR/医美_*.xlsx 2>/dev/null | head -1').toString().trim();
wb.xlsx.readFile(xlsxFile).then(() => {
  const ws = wb.worksheets[0];
  const hr = ws.getRow(1);
  let cols = 0;
  hr.eachCell(() => cols++);
  console.log('列数:', cols);
  console.log('行数:', ws.rowCount);
  // 检查 K 列（截图列）和 N 列（已关注下拉）
  console.log('K 列标题:', ws.getRow(1).getCell(11).value);
  console.log('N 列标题:', ws.getRow(1).getCell(14).value);
  console.log('O 列标题:', ws.getRow(1).getCell(15).value);
  process.exit(cols === 16 ? 0 : 1);
}).catch(err => { console.error(err); process.exit(1); });
"
echo "列数验证 EXIT: $?"
```

**预期：**
- `列数: 16`
- `列数验证 EXIT: 0`

### Step 7.3 打开 Excel 人工核查

```bash
open "$XLSX_FILE"
```

**人工核查要点：**
- [ ] 共 16 列，表头清晰
- [ ] K 列（帖子截图）：若有截图文件则嵌入图片，否则为空
- [ ] N 列（已关注）：下拉选项含 `是` / `否`
- [ ] O 列（跟进状态）：下拉选项含 `待跟进/已联系/有意向/已成交/已流失`
- [ ] 同一用户在同帖有多条评论时，内容合并并显示 `①②` 编号
- [ ] `interestScore >= 8` 的行显示绿色高亮
- [ ] `interestScore >= 6` 的行显示黄色高亮

---

## 阶段 8：清理验证（cleanup-task-specs.js）

### Step 8.1 执行清理

```bash
cd "$SKILL_DIR"

# 清理当前关键词 task spec
node scripts/cleanup-task-specs.js --keyword "医美"
echo "EXIT: $?"

# 删除 analysis_posts 分片目录（成功后应清理）
rm -rf "$DATA_DIR/analysis_posts/医美"
```

**验证：**
```bash
# task spec 应被删除
ls "$DATA_DIR/task-specs/" 2>/dev/null && \
  ls "$DATA_DIR/task-specs/"*医美* 2>/dev/null && \
  echo "⚠ task spec 未被清理" || echo "✅ task spec 已清理"

# analysis_posts/医美 应不存在
[ ! -d "$DATA_DIR/analysis_posts/医美" ] && echo "✅ analysis_posts/医美 已删除" || echo "⚠ 目录未删除"

# 最终产物应保留
ls -la "$DATA_DIR/comments_医美.json" && echo "✅ comments 保留"
ls -la "$DATA_DIR/candidates_医美.json" && echo "✅ candidates 保留"
ls -la "$DATA_DIR/analysis_医美.json" && echo "✅ analysis 保留"
ls -la "$XLSX_FILE" && echo "✅ xlsx 保留"
```

**预期：**
- task spec 文件不存在
- `analysis_posts/医美` 目录不存在
- `comments_医美.json`、`candidates_医美.json`、`analysis_医美.json`、xlsx 文件保留

---

## 阶段 9：失败保留场景验证

> 模拟步骤 6 失败，验证清理策略

### Step 9.1 构造合并失败（>50% 分片缺失）

```bash
cd "$SKILL_DIR"

# 先重新生成 task spec 和 candidates
node scripts/save-task-spec.js \
  --keyword "医美" \
  --json '{"keyword":"医美","post_relevance":{"include":["医美"],"exclude":[]},"comment_filter":{"include":[],"exclude":[]},"semantic_focus":"测试"}'

NEW_SPEC=$(ls "$DATA_DIR/task-specs/"*_医美.json | head -1)

# 创建 candidates（只需 3 帖，方便验证分片缺失）
python3 -c "
import json
candidates = {
    'keyword': '医美',
    'taskSpecPath': '$NEW_SPEC',
    'taskSpec': json.load(open('$NEW_SPEC')),
    'posts': [
        {'title':'帖子A','url':'https://x.com/a','noteId':'note001','comments':[]},
        {'title':'帖子B','url':'https://x.com/b','noteId':'note002','comments':[]},
        {'title':'帖子C','url':'https://x.com/c','noteId':'note003','comments':[]}
    ],
    'skippedPosts':[],
    'stats':{'totalPosts':3,'keptPosts':3,'totalComments':0,'filteredComments':0,'keptComments':0,'filterReasons':{}}
}
json.dump(candidates, open('$DATA_DIR/candidates_医美.json','w'), ensure_ascii=False, indent=2)
print('candidates 写入完成')
"

# 只创建 1 个分片（故意缺失 2 个，>50% 失败率）
mkdir -p "$DATA_DIR/analysis_posts/医美"
echo '{"postId":"note001","title":"帖子A","url":"https://x.com/a","screenshotFile":null,"totalComments":0,"collectedComments":0,"validComments":[]}' \
  > "$DATA_DIR/analysis_posts/医美/note001.json"

# 运行合并，应以非 0 退出
node scripts/merge-analysis.js \
  --keyword "医美" \
  --candidates "$DATA_DIR/candidates_医美.json" \
  --posts-dir "$DATA_DIR/analysis_posts/医美" \
  --output "$DATA_DIR/analysis_医美.json"
echo "EXIT: $?"
```

**预期：**
- EXIT 非 0
- stderr 含 `失败率` 或 `过高` 相关信息

### Step 9.2 验证失败后现场保留

```bash
# task spec 应保留（失败时不清理）
ls "$DATA_DIR/task-specs/"*_医美.json && echo "✅ task spec 保留（失败场景）" || echo "⚠ task spec 丢失"

# analysis_posts 应保留
ls "$DATA_DIR/analysis_posts/医美/" && echo "✅ analysis_posts 保留（失败场景）" || echo "⚠ analysis_posts 丢失"
```

**预期：** task spec 和 analysis_posts 在失败后均保留。

---

## 阶段 10：多关键词隔离验证

### Step 10.1 生成两个关键词的 task spec

```bash
cd "$SKILL_DIR"

# 关键词 1
KW1_SPEC=$(node scripts/save-task-spec.js \
  --keyword "露营装备" \
  --json '{"keyword":"露营装备","post_relevance":{"include":["露营","装备"],"exclude":[]},"comment_filter":{"include":["哪里买","多少钱"],"exclude":[]},"semantic_focus":"露营装备购买意向"}')
echo "KW1 spec: $KW1_SPEC"

# 关键词 2
KW2_SPEC=$(node scripts/save-task-spec.js \
  --keyword "户外徒步" \
  --json '{"keyword":"户外徒步","post_relevance":{"include":["徒步","户外"],"exclude":[]},"comment_filter":{"include":["推荐","哪里"],"exclude":[]},"semantic_focus":"户外徒步用品购买意向"}')
echo "KW2 spec: $KW2_SPEC"
```

### Step 10.2 验证清理隔离

```bash
# 清理 露营装备，不影响 户外徒步
node scripts/cleanup-task-specs.js --keyword "露营装备"

ls "$DATA_DIR/task-specs/"*露营装备* 2>/dev/null && echo "⚠ 露营装备未被清理" || echo "✅ 露营装备 task spec 已清理"
ls "$DATA_DIR/task-specs/"*户外徒步* 2>/dev/null && echo "✅ 户外徒步 task spec 保留" || echo "⚠ 户外徒步 task spec 丢失"

# 清理 户外徒步
node scripts/cleanup-task-specs.js --keyword "户外徒步"
```

**预期：** 两次清理互不干扰。

---

## 阶段 11：参数边界验证

### Step 11.1 xhs-scraper.js 参数边界

```bash
cd "$SKILL_DIR"
SPEC=$(ls "$DATA_DIR/task-specs/"*医美* 2>/dev/null | head -1)
[ -z "$SPEC" ] && SPEC=$(node scripts/save-task-spec.js --keyword "医美" --json '{"keyword":"医美","post_relevance":{"include":["医美"],"exclude":[]},"comment_filter":{"include":[],"exclude":[]},"semantic_focus":"测试"}')

# --speed 未知值应回退 normal
node scripts/xhs-scraper.js --keyword "医美" --task-spec "$SPEC" --speed unknown --max-posts 1 --output /dev/null 2>&1 | head -5 &
PID=$!; sleep 3; kill $PID 2>/dev/null; true
# 注：脚本会等待登录，3 秒后手动中止，目的是验证启动参数解析

# 缺少 --keyword 直接退出
node scripts/xhs-scraper.js --task-spec "$SPEC" 2>&1; echo "缺keyword EXIT: $?"
```

**预期：**
- 缺少 `--keyword` 时 EXIT 非 0

### Step 11.2 filter-comments.js 错误场景

```bash
# 缺 --task-spec
node scripts/filter-comments.js \
  --input "$DATA_DIR/comments_医美.json" \
  --output /tmp/test_candidates.json \
  2>&1; echo "缺task-spec EXIT: $?"

# 输入文件不存在
node scripts/filter-comments.js \
  --input /nonexistent/file.json \
  --output /tmp/test_candidates.json \
  --task-spec "$SPEC" \
  2>&1; echo "文件不存在 EXIT: $?"
```

**预期：** 两条命令均 EXIT 非 0，stderr 有明确错误信息

---

## 阶段 12：全量清理（测试结束后）

```bash
cd "$SKILL_DIR"

# 清理所有测试产物
rm -f "$DATA_DIR/comments_医美.json"
rm -f "$DATA_DIR/candidates_医美.json"
rm -f "$DATA_DIR/analysis_医美.json"
rm -f "$DATA_DIR/comments_露营装备.json" "$DATA_DIR/candidates_露营装备.json"
rm -f "$DATA_DIR/comments_户外徒步.json" "$DATA_DIR/candidates_户外徒步.json"
rm -rf "$DATA_DIR/analysis_posts/"
rm -rf "$DATA_DIR/task-specs/"
mkdir -p "$DATA_DIR/task-specs"

# 不清理 output/（xlsx 文件供人工审查保留）
echo "✅ 测试环境已清理完毕"
echo "xlsx 产物保留于: $OUTPUT_DIR"
ls "$OUTPUT_DIR/"
```

---

## 测试结果汇总模板

执行完成后填写：

| 阶段 | 测试项 | 状态 | 备注 |
|------|--------|------|------|
| 阶段 1 | 自动化测试套件（34 项） | ⬜ 通过 / ⬜ 失败 | |
| 阶段 2 | 环境检测（bootstrap） | ⬜ 通过 / ⬜ 失败 | |
| 阶段 3 | task spec 生成与错误场景 | ⬜ 通过 / ⬜ 失败 | |
| 阶段 4 | 数据采集（需登录） | ⬜ 通过 / ⬜ 跳过 / ⬜ 失败 | |
| 阶段 5 | 粗筛 + 噪声过滤 | ⬜ 通过 / ⬜ 失败 | |
| 阶段 6 | 精筛合并 | ⬜ 通过 / ⬜ 失败 | |
| 阶段 7 | Excel 导出 + 结构验证 | ⬜ 通过 / ⬜ 失败 | |
| 阶段 8 | 成功后清理验证 | ⬜ 通过 / ⬜ 失败 | |
| 阶段 9 | 失败现场保留验证 | ⬜ 通过 / ⬜ 失败 | |
| 阶段 10 | 多关键词隔离 | ⬜ 通过 / ⬜ 失败 | |
| 阶段 11 | 参数边界验证 | ⬜ 通过 / ⬜ 失败 | |

**总结：**
- 通过项：___
- 失败项：___
- 跳过项：___（通常是阶段 4，需要真实小红书账号）

---

## 缺陷记录格式

```
阶段：
命令：
实际输出（前 200 字）：
预期输出：
是否可重现：
```
