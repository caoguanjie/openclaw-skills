#!/usr/bin/env node

/**
 * Excel 生成脚本 - 用户×帖子为中心的潜客管理表
 *
 * 行粒度: 一行 = 一个用户在一个帖子下的所有评论（合并）
 * 同一用户在不同帖子各占一行，方便筛选。
 *
 * 用法:
 *   node generate-excel.js --input analysis.json --output output.xlsx
 *
 * 输入 JSON 格式 (analysis.json):
 * {
 *   "keyword": "医美",
 *   "posts": [
 *     {
 *       "title": "帖子标题",
 *       "url": "帖子链接",
 *       "screenshotFile": "/path/to/screenshot.png",
 *       "totalComments": 15,
 *       "collectedComments": 10,
 *       "validComments": [
 *         {
 *           "username": "xxx",
 *           "userId": "xxx",
 *           "content": "评论原文",
 *           "ipLocation": "广东",
 *           "interestTags": "购买意向, 咨询",
 *           "interestScore": 7,
 *           "reason": "判断理由",
 *           "profileUrl": "用户主页链接"
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

const fs = require("fs");
const path = require("path");

let ExcelJS;
try {
  ExcelJS = require("exceljs");
} catch {
  console.error("❌ 需要安装 exceljs: npm install exceljs");
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    input: path.join(__dirname, "..", "data", "analysis.json"),
    output: "",
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") opts.input = args[++i];
    else if (args[i] === "--output") opts.output = args[++i];
  }
  if (!fs.existsSync(opts.input)) {
    console.error(`❌ 输入文件不存在: ${opts.input}`);
    process.exit(1);
  }
  return opts;
}

/**
 * 将同一帖子下同一用户的多条评论合并为一条记录
 * 评论内容用编号分行展示: ①xxx\n②xxx
 */
function groupCommentsByUser(comments) {
  const userMap = new Map();
  const circleNums = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

  for (const c of comments) {
    const key = c.userId || c.username;
    if (!userMap.has(key)) {
      userMap.set(key, {
        username: c.username,
        userId: c.userId,
        profileUrl: c.profileUrl,
        ipLocation: c.ipLocation || "",
        contents: [],
        scores: [],
        tags: new Set(),
        reasons: [],
      });
    }
    const user = userMap.get(key);
    user.contents.push(c.content);
    user.scores.push(c.interestScore || 0);
    if (c.interestTags) {
      for (const tag of c.interestTags.split(/[,，]/).map((t) => t.trim())) {
        if (tag) user.tags.add(tag);
      }
    }
    if (c.reason) user.reasons.push(c.reason);
    // 保留非空的 ipLocation
    if (c.ipLocation && !user.ipLocation) {
      user.ipLocation = c.ipLocation;
    }
  }

  const result = [];
  for (const user of userMap.values()) {
    const commentCount = user.contents.length;
    let mergedContent;
    if (commentCount === 1) {
      mergedContent = user.contents[0];
    } else {
      mergedContent = user.contents
        .map((text, i) => `${circleNums[i] || `(${i + 1})`}${text}`)
        .join("\n");
    }

    // 兴趣得分取最高分
    const maxScore = Math.max(...user.scores);

    // 理由合并（去重）
    const uniqueReasons = [...new Set(user.reasons)];
    let mergedReason;
    if (uniqueReasons.length === 1) {
      mergedReason = uniqueReasons[0];
    } else {
      mergedReason = uniqueReasons
        .map((r, i) => `${circleNums[i] || `(${i + 1})`}${r}`)
        .join("\n");
    }

    result.push({
      username: user.username,
      profileUrl: user.profileUrl,
      ipLocation: user.ipLocation,
      commentCount,
      content: mergedContent,
      interestScore: maxScore,
      interestTags: [...user.tags].join(", "),
      reason: mergedReason,
    });
  }

  // 按兴趣得分降序排列
  result.sort((a, b) => b.interestScore - a.interestScore);
  return result;
}

async function main() {
  const opts = parseArgs();
  const data = JSON.parse(fs.readFileSync(opts.input, "utf-8"));

  if (!opts.output) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStr = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
    const outputDir = path.join(__dirname, "..", "output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    opts.output = path.join(outputDir, `${data.keyword || "export"}_${dateStr}_${timeStr}.xlsx`);
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("潜客管理");

  // 16列定义 — 4个区域（宽松布局，方便阅读）
  ws.columns = [
    // 用户信息区
    { header: "用户名", key: "username", width: 18 },
    { header: "用户主页", key: "profileUrl", width: 20 },
    { header: "IP属地", key: "ipLocation", width: 10 },
    // 兴趣分析区
    { header: "评论数量", key: "commentCount", width: 10 },
    { header: "评论内容", key: "content", width: 55 },
    { header: "兴趣得分", key: "interestScore", width: 10 },
    { header: "兴趣标签", key: "interestTags", width: 25 },
    { header: "判断理由", key: "reason", width: 45 },
    // 来源帖子区
    { header: "帖子标题", key: "postTitle", width: 40 },
    { header: "帖子链接", key: "postUrl", width: 20 },
    { header: "帖子截图", key: "screenshot", width: 25 },
    { header: "帖子总评论数", key: "totalComments", width: 14 },
    { header: "本次获取评论数", key: "collectedComments", width: 16 },
    // 跟进管理区
    { header: "已关注", key: "followed", width: 10 },
    { header: "跟进状态", key: "followUpStatus", width: 14 },
    { header: "负责人", key: "owner", width: 12 },
  ];

  // 区域分组的颜色
  const headerColors = {
    user: "FF2E75B6",      // 蓝色 — 用户信息
    interest: "FF548235",  // 绿色 — 兴趣分析
    post: "FFBF8F00",     // 金色 — 来源帖子
    followUp: "FFC00000", // 红色 — 跟进管理
  };
  const headerColorMap = [
    "user", "user", "user",
    "interest", "interest", "interest", "interest", "interest",
    "post", "post", "post", "post", "post",
    "followUp", "followUp", "followUp",
  ];

  // 表头样式
  const hdrRow = ws.getRow(1);
  hdrRow.height = 28;
  hdrRow.eachCell((cell, colNumber) => {
    const colorKey = headerColorMap[colNumber - 1];
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Arial" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColors[colorKey] } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];

  // 跟进状态下拉选项
  const followUpOptions = ["待跟进", "已联系", "有意向", "已成交", "已流失"];
  const followedOptions = ["是", "否"];

  // 交替背景色（按帖子分组）
  const bandColors = ["FFF2F7FB", "FFFFFFFF"];
  let currentRow = 2;
  let totalUsers = 0;
  const addedImages = new Map();

  for (let pi = 0; pi < data.posts.length; pi++) {
    const post = data.posts[pi];
    const comments = post.validComments || [];
    const collectedComments = post.collectedComments || comments.length;
    const bandColor = bandColors[pi % 2];

    // 按用户合并评论
    const userRows = groupCommentsByUser(comments);
    if (userRows.length === 0) continue;

    const startRow = currentRow;

    for (const userRow of userRows) {
      const row = ws.getRow(currentRow);

      // 用户信息区
      row.getCell("A").value = userRow.username;
      // 用户主页 — 超链接短文本
      if (userRow.profileUrl) {
        row.getCell("B").value = { text: "查看主页", hyperlink: userRow.profileUrl };
        row.getCell("B").font = { size: 10, name: "Arial", color: { argb: "FF0563C1" }, underline: true };
      }
      row.getCell("C").value = userRow.ipLocation;

      // 兴趣分析区
      row.getCell("D").value = userRow.commentCount;
      row.getCell("E").value = userRow.content;
      row.getCell("F").value = userRow.interestScore;
      row.getCell("G").value = userRow.interestTags;
      row.getCell("H").value = userRow.reason;

      // 来源帖子区
      row.getCell("I").value = post.title;
      // 帖子链接 — 超链接短文本
      if (post.url) {
        row.getCell("J").value = { text: "查看帖子", hyperlink: post.url };
        row.getCell("J").font = { size: 10, name: "Arial", color: { argb: "FF0563C1" }, underline: true };
      }
      row.getCell("K").value = ""; // 截图占位
      row.getCell("L").value = post.totalComments;
      row.getCell("M").value = collectedComments;

      // 跟进管理区（空，留给用户手动填写）
      row.getCell("N").value = "";
      row.getCell("O").value = "";
      row.getCell("P").value = "";

      // 行高根据评论数量动态调整
      const lineCount = (userRow.content.match(/\n/g) || []).length + 1;
      row.height = Math.max(25, lineCount * 18);

      // 行样式
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { size: 10, name: "Arial" };
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bandColor } };
        // 边框
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        };
      });

      // 评论数量居中
      row.getCell("D").alignment = { horizontal: "center", vertical: "middle" };

      // 得分高亮 + 居中
      const scoreCell = row.getCell("F");
      scoreCell.alignment = { horizontal: "center", vertical: "middle" };
      scoreCell.font = { bold: true, size: 10, name: "Arial" };
      if (userRow.interestScore >= 8) {
        scoreCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
        scoreCell.font.color = { argb: "FF006100" };
      } else if (userRow.interestScore >= 6) {
        scoreCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEB9C" } };
        scoreCell.font.color = { argb: "FF9C5700" };
      }

      // 帖子总评论数、本次获取评论数居中
      row.getCell("L").alignment = { horizontal: "center", vertical: "middle" };
      row.getCell("M").alignment = { horizontal: "center", vertical: "middle" };

      // 已关注列居中
      row.getCell("N").alignment = { horizontal: "center", vertical: "middle" };
      // 跟进状态居中
      row.getCell("O").alignment = { horizontal: "center", vertical: "middle" };

      // 数据验证 — 已关注下拉
      row.getCell("N").dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${followedOptions.join(",")}"`],
      };

      // 数据验证 — 跟进状态下拉
      row.getCell("O").dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${followUpOptions.join(",")}"`],
      };

      currentRow++;
      totalUsers++;
    }

    const endRow = currentRow - 1;

    // 嵌入帖子截图（如果有多个用户行，截图只在第一行显示）
    if (post.screenshotFile && fs.existsSync(post.screenshotFile)) {
      let imageId = addedImages.get(post.screenshotFile);
      if (!imageId) {
        imageId = wb.addImage({ filename: post.screenshotFile, extension: "png" });
        addedImages.set(post.screenshotFile, imageId);
      }

      // 调整截图所在行的行高
      const imgRow = ws.getRow(startRow);
      imgRow.height = Math.max(imgRow.height, 80);

      ws.addImage(imageId, {
        tl: { col: 10, row: startRow - 1 }, // K列 = col index 10
        br: { col: 11, row: startRow },
        editAs: "oneCell",
      });
    }
  }

  // 自动筛选（启用筛选按钮）
  ws.autoFilter = { from: "A1", to: `P${currentRow - 1}` };

  await wb.xlsx.writeFile(opts.output);

  console.log(`✅ Excel 已生成: ${opts.output}`);
  console.log(`   帖子: ${data.posts.length}`);
  console.log(`   用户行: ${totalUsers}`);
  console.log(`   嵌入截图: ${addedImages.size} 张`);
}

main().catch((e) => {
  console.error("❌ 生成失败:", e.message);
  process.exit(1);
});
