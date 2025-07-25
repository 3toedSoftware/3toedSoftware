/**
 * canvas-txt v3.0.0
 * https://github.com/geongeorge/Canvas-Txt
 * MIT License
 * 
 * Lightweight canvas text rendering with automatic line wrapping
 */

const defaultSettings = {
  align: "center",
  vAlign: "middle",
  fontSize: 14,
  fontFamily: "Arial",
  fontStyle: "",
  fontVariant: "",
  fontWeight: "",
  fontColor: "#000000",
  justify: false,
  lineHeight: 1
};

const getTextHeight = ({ ctx, text, style }) => {
  const previousTextBaseline = ctx.textBaseline;
  const previousFont = ctx.font;

  ctx.textBaseline = "bottom";
  ctx.font = style;
  const { actualBoundingBoxAscent: height } = ctx.measureText(text);

  ctx.textBaseline = previousTextBaseline;
  ctx.font = previousFont;

  return height;
};

const drawText = (ctx, myText, inputConfig = {}) => {
  const { width, height, x, y } = inputConfig;

  const config = { ...defaultSettings, ...inputConfig };

  if (width <= 0 || height <= 0 || config.fontSize <= 0) {
    console.error("canvas-txt: Must have width, height, x, y and fontSize");
    return { height: 0 };
  }

  const { fontFamily, fontSize, fontWeight, fontVariant, fontStyle, lineHeight } = config;

  const style = `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}px ${fontFamily}`;

  const textHeightConst = getTextHeight({ ctx, text: "M", style });

  const textHeight = textHeightConst * lineHeight;

  const { width: textWidth } = ctx.measureText(myText);

  let words = [];
  let lines = [];

  if (textWidth > width) {
    words = myText.split(" ").filter((word) => word !== "");
    let newLine = "";

    words.forEach((word) => {
      const testLine = `${newLine} ${word}`.trim();
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth > width) {
        lines.push(newLine);
        newLine = word;
      } else {
        newLine = testLine;
      }
    });
    lines.push(newLine);
  } else {
    lines.push(myText);
  }

  // Handle manual line breaks
  const processedLines = [];
  lines.forEach(line => {
    const manualBreaks = line.split('\n');
    processedLines.push(...manualBreaks);
  });
  lines = processedLines;

  const totalTextHeight = lines.length * textHeight;

  let yPos = y;

  // Vertical alignment
  if (config.vAlign === "middle") {
    yPos = y + height / 2 - totalTextHeight / 2;
  } else if (config.vAlign === "bottom") {
    yPos = y + height - totalTextHeight;
  }

  // Save context state
  ctx.save();
  
  // Set text properties
  ctx.font = style;
  ctx.fillStyle = config.fontColor;
  ctx.textBaseline = "top";

  lines.forEach((line, index) => {
    const lineY = yPos + index * textHeight;
    
    let xPos = x;
    const { width: lineWidth } = ctx.measureText(line);

    // Horizontal alignment
    if (config.align === "center") {
      xPos = x + (width - lineWidth) / 2;
    } else if (config.align === "right") {
      xPos = x + width - lineWidth;
    }

    // Justify text
    if (config.justify && index < lines.length - 1 && lines.length > 1) {
      const words = line.split(" ").filter(word => word !== "");
      if (words.length > 1) {
        const wordsWidth = words.reduce((acc, word) => {
          return acc + ctx.measureText(word).width;
        }, 0);
        const spacingWidth = (width - wordsWidth) / (words.length - 1);
        
        let currentX = x;
        words.forEach((word, wordIndex) => {
          ctx.fillText(word, currentX, lineY);
          const wordWidth = ctx.measureText(word).width;
          currentX += wordWidth + (wordIndex < words.length - 1 ? spacingWidth : 0);
        });
      } else {
        ctx.fillText(line, xPos, lineY);
      }
    } else {
      ctx.fillText(line, xPos, lineY);
    }
  });

  // Restore context state
  ctx.restore();

  return {
    height: totalTextHeight
  };
};

// Export for use
export { drawText, getTextHeight };
export default { drawText, getTextHeight };