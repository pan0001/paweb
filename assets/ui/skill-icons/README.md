# Kivo 技能图标对应

2026-09-13，按本站 37 个 `kivoId`（包含装束）访问古书馆公开学生资料：`https://api.kivo.wiki/api/v1/data/students/{kivoId}`，读取 `character_datas.skill` 中的原始图标链接。PNG 按原字节保存在本站，不运行时热链；素材版权归原权利方。

共 111 个技能位置，107 个不同来源 URL 的 PNG（约 440 KiB）。按名称或译名对应 89 项、组合被动参考 3 项、本站改编技能参考 19 项。**名称对应不代表原作效果和本站机制相同**；没有修改任何 PA 技能名称、说明、冷却或数值。图标一般为透明底白色图案，由页面按攻击类型提供红／黄／蓝／紫底板，原图不染色、不裁切。

## 对应规则

- `scripts/skill-icon-map.json`：人工逐项审核的 E／Q／被动对应，包含参考理由；不是按数组位置自动套用。
- `kivo-skills.json`：本次公开接口的技能名称、图标地址、最高等级效果与形态快照，用于复核来源，不用于本站数值展示。
- `catalog.json`：每个 PA 技能的原作来源名称、键、对应类型，以及文件大小／原图尺寸／SHA-256。
- `catalog.js`：浏览器所需的精简本地映射；中文、English、日本語共用同一份图像。
- `name`：同名或译名对应；`composite`：组合被动选取其中主要技能；`reference`：同角色、同装束的视觉参考，并非原作等效技能。后两类在界面明确标识。

特别复核：凯伊的 E 对应原作 EX、Q 对应基础技能；光的 E 对应辅助技能；千世 E／被动的顺序不同；临战爱丽丝 Q 使用「觉醒：超新星」派生图标；睡衣诺亚 E 使用第二种 EX；星野只使用防御形态，伊吹使用通常绘画 EX，亚津子不采用废案 EX。胡桃、妮可等本站自创机制不冒充原作技能。

## 维护

```powershell
node scripts/sync-skill-icons.mjs --index-only
# 人工对照新快照复核 scripts/skill-icon-map.json，尤其注意顺序、装束和派生技能
node scripts/sync-skill-icons.mjs
node scripts/check-skill-icons.cjs
node scripts/check-preview.mjs
```

接口更新后需重新人工审核映射，不能直接沿用旧顺序。下载器拒绝非 Kivo 静态域名、非 PNG、废案技能及覆盖已改变的本地图像。加载失败时保留技能文本与可操作的通用图标回退；高对比模式采用可辨认的矢量回退。
