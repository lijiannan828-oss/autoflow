import type { ArtAssetsData, ScriptHighlight, Character, Scene, Prop } from "./art-types"

const highlights: ScriptHighlight[] = [
  {
    id: "h1",
    title: "亮点1：红酒泼身与当众揭身的极致羞辱",
    content: "开场即高潮，通过维多利亚伸脚绊倒克莱尔、红酒浸透灰色制服以及保安强行搜身的画面，快速建立极大的阶级压迫感，激发观众对女主的同情与对反派的愤恨。",
  },
  {
    id: "h2",
    title: "亮点2：女佣随手夺掉两亿合同的降维打击",
    content: "身份反差极强的爽点，克莱尔在深夜书房的便签纸上，用专业的金融逻辑指出致命漏洞，这种「扫地僧」式的智商碾压，让观众对女主的真实身份产生强烈好奇。",
  },
  {
    id: "h3",
    title: "亮点3：握紧父亲旧钢笔向合影仇人宣战",
    content: "结尾处克莱尔站在暗处，盯着仇人马库斯的合影，手中旧钢笔的特写与五年前FBI抓捕父亲的闪回画面交织，一句「游戏开始了」将复仇情绪推向顶点，留下极强的追剧悬念。",
  },
]

const artStyle = {
  id: "style-1",
  baseStyle: "基础画风风格词：影视质感",
  visualDescription: "视觉风格描述：整体采用高对比度的电影级写实质感，通过光影明暗对比强化阶级压迫感。宴会场景以璀璨华丽的暖金色影射托蒙哥马利家族的虚伪繁荣，与女主灰冷色调的单薄制服形成鲜明对比；深夜书房与复仇宣战场景则转为冷峻的深蓝与暗黑色调，强调智商博弈的精密感。画面注重细节纹理的刻画，如红酒浸透织物的湿冷感、旧钢笔的金属光泽，营造出一种隐忍、深沉且极具爆发力的复仇氛围。",
  isLocked: false,
}

function makeCharacterImages(baseColor: string, seed: number): Character["images"] {
  const colors = [baseColor, `${baseColor}dd`, `${baseColor}bb`, `${baseColor}99`]
  return colors.map((c, i) => ({
    id: `img-${seed}-${i}`,
    thumbnailColor: c,
    prompt: `Character portrait, cinematic lighting, high detail, ${seed}`,
    score: 7.5 + Math.random() * 2,
    isLocked: false,
  }))
}

const characters: Character[] = [
  {
    id: "char-1",
    name: "克莱尔-女佣装",
    description: "隐姓埋名的落魄千金，貌神隐忍而坚毅，在蒙哥马利家族担任底层女佣。",
    prompt: "[克莱尔-女佣装]（深棕色低马尾灰裙女佣）伸出的腿绊住，身体猛地向前倾斜失去平衡，手中托盘上的高脚杯倾倒，深红色的液体在空中飞溅而出。",
    images: makeCharacterImages("#8B7355", 1),
    lockedImageId: null,
  },
  {
    id: "char-2",
    name: "克莱尔-千金装",
    description: "五年前的克莱尔，高贵、纯真且自信，处于家族鼎盛时期。",
    prompt: "[克莱尔-千金装]（金色卷发白裙女子）站在落地窗前，阳光洒在她身上，眼神中充满对未来的憧憬。",
    images: makeCharacterImages("#D4AF37", 2),
    lockedImageId: "img-2-0",
  },
  {
    id: "char-3",
    name: "维多利亚",
    description: "嚣张跋扈的豪门大小姐，蒙哥马利家族成员，性格刻薄。",
    prompt: "[维多利亚]（红亮片抹胸裙女子）伸出的腿绊住，嘴角挂着轻蔑的微笑，手中红酒杯轻晃。",
    images: makeCharacterImages("#DC143C", 3),
    lockedImageId: null,
  },
  {
    id: "char-4",
    name: "马库斯",
    description: "阴险城府的商业大亨，克莱尔的杀父仇人，蒙哥马利家族的核心人物。",
    prompt: "[马库斯]（灰发西装中年男子）坐在皮革沙发上，手指轻敲扶手，眼神锐利如鹰。",
    images: makeCharacterImages("#4A4A4A", 4),
    lockedImageId: "img-4-1",
  },
  {
    id: "char-5",
    name: "阿瑟·万斯",
    description: "克莱尔的父亲，曾经的商业巨头，闪回中展现其入狱前的威严与入狱后的憔悴。",
    prompt: "[阿瑟·万斯]（银发绅士）站在办公室落地窗前，背对镜头，双手背后，俯瞰城市天际线。",
    images: makeCharacterImages("#708090", 5),
    lockedImageId: null,
  },
  {
    id: "char-6",
    name: "旧钢笔",
    description: "阿瑟·万斯留下的遗物，复仇的象征，具有复古的金属质感。",
    prompt: "[旧钢笔]特写，金属笔身泛着岁月的光泽，笔尖微微反光，放置在深色木桌上。",
    images: makeCharacterImages("#B8860B", 6),
    lockedImageId: "img-6-2",
  },
]

function makeSceneImages(baseColor: string, seed: number): Scene["images"] {
  const colors = [baseColor, `${baseColor}dd`, `${baseColor}bb`, `${baseColor}99`]
  return colors.map((c, i) => ({
    id: `scene-img-${seed}-${i}`,
    thumbnailColor: c,
    prompt: `Cinematic scene, wide angle, atmospheric lighting, ${seed}`,
    score: 7.5 + Math.random() * 2,
    isLocked: false,
  }))
}

const scenes: Scene[] = [
  {
    id: "scene-1",
    name: "蒙哥马利宴会大厅",
    description: "蒙哥马利家族举办奢华宴会的场所，充满虚伪的繁荣感。水晶吊灯散发璀璨金光，大理石地面光可鉴人，整体氛围雍容华丽而压抑。",
    prompt: "[蒙哥马利宴会大厅]全景，水晶吊灯璀璨，大理石地面反射金色光芒，宾客穿梭其间，暖色调营造虚假繁华。",
    images: makeSceneImages("#DAA520", 10),
    lockedImageId: "scene-img-10-0",
  },
  {
    id: "scene-2",
    name: "豪宅私人书房",
    description: "伊桑处理机密文件的场所，环境精密且冷峻。深夜时分，只有台灯投射出有限的光亮，四周被高大的书架环绕，充满智商博弈的严肃感。",
    prompt: "[豪宅私人书房]深夜场景，台灯投射局部光亮，高大书架环绕，深蓝色调营造冷峻智性氛围。",
    images: makeSceneImages("#1E3A5F", 11),
    lockedImageId: null,
  },
  {
    id: "scene-3",
    name: "万斯家族旧宅大厅（闪回）",
    description: "五年前克莱尔父亲尚未入狱时的家，装潢风格较蒙哥马利家族更显典雅。此处是闪回中生日宴会与变故发生的地点。",
    prompt: "[万斯家族旧宅大厅]闪回场景，典雅装潢，暖色壁灯，家族合影挂在墙上，氛围温馨却带有即将破碎的预感。",
    images: makeSceneImages("#8B4513", 12),
    lockedImageId: null,
  },
  {
    id: "scene-4",
    name: "监狱探视室（闪回）",
    description: "克莱尔与父亲最后诀别的场所，环境简陋、冰冷且充满绝望。厚重的防弹玻璃将空间一分为二，日光灯发出惨白的光。",
    prompt: "[监狱探视室]闪回场景，防弹玻璃隔断，惨白日光灯，冰冷金属椅，父女隔窗相望。",
    images: makeSceneImages("#696969", 13),
    lockedImageId: "scene-img-13-1",
  },
  {
    id: "scene-5",
    name: "豪宅暗处走廊",
    description: "克莱尔最终宣战的隐蔽角落。光线极度昏暗，墙上挂着家族合影，冷峻的色调预示着复仇游戏的开始。",
    prompt: "[豪宅暗处走廊]极暗光线，墙上家族合影若隐若现，深蓝冷色调，女主身影隐于暗处。",
    images: makeSceneImages("#2F4F4F", 14),
    lockedImageId: null,
  },
]

function makePropImages(baseColor: string, seed: number): Prop["images"] {
  const colors = [baseColor, `${baseColor}dd`, `${baseColor}bb`, `${baseColor}99`]
  return colors.map((c, i) => ({
    id: `prop-img-${seed}-${i}`,
    thumbnailColor: c,
    prompt: `Product shot, studio lighting, high detail, ${seed}`,
    score: 7.5 + Math.random() * 2,
    isLocked: false,
  }))
}

const props: Prop[] = [
  {
    id: "prop-1",
    name: "旧钢笔",
    description: "阿瑟·万斯留下的遗物，复仇的象征，具有复古的金属质感。",
    prompt: "[旧钢笔]特写，复古金属笔身，岁月痕迹，深色木桌背景，侧光勾勒轮廓。",
    images: makePropImages("#B8860B", 20),
    lockedImageId: "prop-img-20-0",
  },
  {
    id: "prop-2",
    name: "红酒杯",
    description: "宴会场景中的关键道具，象征阶级与羞辱。",
    prompt: "[红酒杯]特写，高脚水晶杯，深红酒液，光线折射，华丽背景虚化。",
    images: makePropImages("#722F37", 21),
    lockedImageId: null,
  },
  {
    id: "prop-3",
    name: "女佣制服",
    description: "克莱尔隐姓埋名时的身份象征，灰色朴素，与宴会华丽形成对比。",
    prompt: "[女佣制服]平铺展示，灰色棉质面料，白色围裙，简洁剪裁，柔和光线。",
    images: makePropImages("#808080", 22),
    lockedImageId: null,
  },
  {
    id: "prop-4",
    name: "商业合同文件",
    description: "书房场景中的关键道具，克莱尔发现致命漏洞的载体。",
    prompt: "[商业合同文件]特写，厚实纸张，红色印章，台灯投射局部光亮，深色桌面。",
    images: makePropImages("#F5F5DC", 23),
    lockedImageId: "prop-img-23-2",
  },
]

export const artAssetsData: ArtAssetsData = {
  projectName: "万斯家族的回响：游戏开始",
  scriptSummary: "隐姓埋名在仇家蒙哥马利家族做底层女佣，在宴会上遭受维多利亚的红酒泼身与当众搜身，受尽羞辱。她凭借过人的商业天赋，暗中修改了东家足以损失两亿的合同漏洞，展现出惊人的隐藏实力。闪回五年前父亲被陷害入狱惨死的真相逐渐浮现，克莱尔握紧父亲留下的旧钢笔，正式向仇人马库斯开启一场智商与财富的复仇游戏。",
  highlights,
  artStyle,
  characters,
  scenes,
  props,
}
