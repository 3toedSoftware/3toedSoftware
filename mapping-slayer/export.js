// export.js
function decodeRawData(hexString) {
    try {
        // Convert hex string to Uint8Array
        const bytes = new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        
        // Decompress using pako
        const decompressed = pako.inflate(bytes, { to: 'string' });
        
        return decompressed;
    } catch (error) {
        console.error('Failed to decode Raw data:', error);
        return null;
    }
}

function generateTextBoxRawData(mapX, mapY, content, pageHeight, outlineColor = '#F72020', textColor = '#FFFFFF') {
    try {
        // Convert coordinates from Canvas to PDF space
        const scaleFactor = appState.pdfScale || 4.0;
        const pdfX = mapX / scaleFactor;
        const pdfY = pageHeight - (mapY / scaleFactor); // Fixed Y conversion: bottom-up PDF coordinate system
        const effectiveMultiplier = appState.dotSize * 2;
        
        // Make text box slightly larger than circle (matching JADE example proportions)
        // JADE: circle ~24px, text box ~32x26 = 35% larger width, 10% larger height
        const circleSize = 20 * effectiveMultiplier;
        const annotationWidth = circleSize;
        const annotationHeight = circleSize;
        const halfWidth = annotationWidth / 2;
        const halfHeight = annotationHeight / 2;
        
        const x1 = pdfX - halfWidth;
        const y1 = pdfY - halfHeight;
        const x2 = pdfX + halfWidth;
        const y2 = pdfY + halfHeight;
        
        // Convert text color to RGB
        const textR = parseInt(textColor.substr(1, 2), 16) / 255;
        const textG = parseInt(textColor.substr(3, 2), 16) / 255;
        const textB = parseInt(textColor.substr(5, 2), 16) / 255;
        
        // Escape content for PDF
        const safeContent = content.replace(/[()\\]/g, '\\$&');
        
        // Calculate font size based on text box size (like JADE example)
        const fontSize = Math.max(8, Math.min(annotationHeight * 0.25, 18));
        const margin = fontSize * 0.2; // Small margin like JADE
        const lineHeight = fontSize * 1.15;
        
        // Create professional text box like JADE example
        // Using Arial (universally available) instead of FuturaBT
        const richContent = `<?xml version="1.0"?><body xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:contentType="text/html" xfa:APIVersion="BluebeamPDFRevu:2018" xfa:spec="2.2.0" style="font:'Arial Narrow' ${fontSize}pt; text-align:center; text-valign:middle; margin:${margin}pt; line-height:${lineHeight}pt; color:${textColor}" xmlns="http://www.w3.org/1999/xhtml"><p style="margin:${margin * 1.2}pt; margin-left:0pt; margin-right:0pt; margin-top:0pt; margin-bottom:0pt; line-height:${lineHeight}pt; font-size:${fontSize}pt">${safeContent}</p></body>`;
        
        // Create PDF content with professional formatting (matching JADE structure)
        const pdfContent = `<</Type/Annot/Subtype/FreeText/Rect[${x1} ${y1} ${x2} ${y2}]/Contents(${safeContent})/F 4/C[]/DA(${textR} ${textG} ${textB} rg)/DS(font: 'Arial Narrow' ${fontSize}pt; text-align:center; text-valign:middle; margin:${margin}pt; line-height:${lineHeight}pt; color:${textColor})/RC(${richContent.replace(/[()\\]/g, '\\$&')})/BS<</S/S/Type/Border/W 0>>>>`;
        
        // Compress the content
        const compressed = pako.deflate(pdfContent);
        const hexString = Array.from(compressed).map(byte => byte.toString(16).padStart(2, '0')).join('');
        
        return hexString;
        
    } catch (error) {
        console.error('Text box Raw data generation failed:', error);
        // Fallback to minimal raw data
        return "789c2b292829cc4bcc2db64a2db6482c492dd1482949cc4dcb4dcc49750100c2ea0701";
    }
}

function generateRawDataForCoordinates(mapX, mapY, content, pageHeight, markerTypeColor = '#F72020') {
    // Use the Mechanical template for circles with proper fill
    const templateRaw = "789c8d90dd6a835010845fc5bbe845dd5d3d1e3d2508f127554c62a3b6a5482e6c7aa0b6268a31d0be7dd5d0fb32b0ccc232cb37cb25c47e89ba436473662ba8a370d01486315966a3e538c601b2a04465d6010a79ea3caffd2e893353b71da110138e8e8ea910e7b66e2253c83248b78418afd50fd9c873a50f7d7df9aa34f07b590d757b0eaa41aac1bd818685641211b309ef902f10171ae4d7b74f356c9ababb480db2021efaf6da413cba34df27c52a4bc2a74d18edf308bc3cf6dbe67a9a22ab52d5666d433f5aed627fb5b9edeb34d20eb0dbaa5e922679b00fd7c5b3f798c6aff3afe1a793e0d7fdb19190c9e3f03fb6b5c2602a8f0b24c1e9568f978f9de6a38a29d36bfb77d9c38b82ae0bdb3f5e66108a71587768cdbcaefb0b571b6584";
    
    try {
        // Decode the template
        const bytes = new Uint8Array(templateRaw.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        let decodedTemplate = pako.inflate(bytes, { to: 'string' });
        
        // Convert coordinates from Canvas to PDF space
        const scaleFactor = appState.pdfScale || 4.0;
        const pdfX = mapX / scaleFactor;
        const pdfY = pageHeight - (mapY / scaleFactor); // Fixed Y conversion: bottom-up PDF coordinate system
        
        const annotationWidth = 20 * appState.dotSize;
        const annotationHeight = 20 * appState.dotSize;
        const halfWidth = annotationWidth / 2;
        const halfHeight = annotationHeight / 2;
        
        const x1 = pdfX - halfWidth;
        const y1 = pdfY - halfHeight;
        const x2 = pdfX + halfWidth;
        const y2 = pdfY + halfHeight;
        const newRectCoords = `${x1} ${y1} ${x2} ${y2}`;
        
        // Replace coordinates
        decodedTemplate = decodedTemplate.replace(/\/TempBBox\[[^\]]+\]/, `/TempBBox[${newRectCoords}]`);
        decodedTemplate = decodedTemplate.replace(/\/Rect\[[^\]]+\]/, `/Rect[${newRectCoords}]`);
        
        // Convert hex color to RGB for fill and outline
        const r = parseInt(markerTypeColor.substr(1, 2), 16) / 255;
        const g = parseInt(markerTypeColor.substr(3, 2), 16) / 255;
        const b = parseInt(markerTypeColor.substr(5, 2), 16) / 255;
        
        // Update colors
        decodedTemplate = decodedTemplate.replace(/\/IC\[[^\]]+\]/, `/IC[${r} ${g} ${b}]`);
        decodedTemplate = decodedTemplate.replace(/\/C\[[^\]]+\]/, `/C[${r} ${g} ${b}]`);
        
        // Add content if provided
        if (content) {
            const safeContent = content.replace(/[()\\]/g, '\\$&');
            if (decodedTemplate.includes('>>')) {
                decodedTemplate = decodedTemplate.replace('>>', `/Contents(${safeContent})>>`);
            }
        }
        
        // Re-compress
        const compressed = pako.deflate(decodedTemplate);
        const hexString = Array.from(compressed).map(byte => byte.toString(16).padStart(2, '0')).join('');
        
        return hexString;
        
    } catch (error) {
        console.error('Raw data generation failed:', error);
        return templateRaw;
    }
}

function getCurrentDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function drawLegendWithJsPDF(pdf, dotsOnPage) {
    if (dotsOnPage.length === 0) return;
    const usedMarkerTypeCodes = new Set(dotsOnPage.map(d => d.markerType));
    const sortedMarkerTypeCodes = Array.from(usedMarkerTypeCodes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const padding = 40, itemHeight = 32, dotRadius = 10, legendWidth = 440, headerHeight = 50;
    const legendHeight = headerHeight + (sortedMarkerTypeCodes.length * itemHeight) + padding;
    const x = padding, y = padding;
    pdf.setFillColor(255, 255, 255); pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(1);
    pdf.rect(x, y, legendWidth, legendHeight, 'FD');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(32); pdf.setTextColor(0, 0, 0);
    pdf.text('PAGE LEGEND', x + legendWidth / 2, y + 34, { align: 'center' });
    let currentY = y + headerHeight + 20; pdf.setFont('helvetica', 'normal');
    sortedMarkerTypeCodes.forEach(code => {
        const typeData = appState.markerTypes[code];
        const count = dotsOnPage.filter(d => d.markerType === code).length;
        const displayText = `(${count}) ${typeData.code} - ${typeData.name}`;
        pdf.setFillColor(typeData.color); pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(1);
        pdf.circle(x + padding, currentY, dotRadius, 'FD');
        pdf.setFontSize(24); pdf.setTextColor(0, 0, 0);
        pdf.text(displayText, x + padding + 30, currentY, { baseline: 'middle' });
        currentY += itemHeight;
    });
}

function drawDotsWithJsPDF(pdf, dotsOnPage, messagesVisible) {
    const effectiveMultiplier = appState.dotSize * 2; 
    dotsOnPage.forEach(dot => {
        const markerTypeInfo = appState.markerTypes[dot.markerType] || { color: '#ff0000', textColor: '#FFFFFF' };
        const radius = (20 * effectiveMultiplier) / 2;
        const fontSize = 8 * effectiveMultiplier;
        const pdfX = dot.x; const pdfY = dot.y;
        
        pdf.setFillColor(markerTypeInfo.color);
        pdf.setDrawColor(markerTypeInfo.color);
        pdf.circle(pdfX, pdfY, radius, 'F');
        
        if (dot.isCodeRequired) {
            pdf.setDrawColor(25, 25, 25);
            pdf.setLineWidth(5);
            pdf.circle(pdfX, pdfY, radius + 2.5, 'S');
            pdf.setDrawColor(242, 255, 0);
            pdf.setLineWidth(3);
            pdf.circle(pdfX, pdfY, radius + 1.5, 'S');
        }

        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(fontSize); pdf.setTextColor(markerTypeInfo.textColor);
        pdf.text(dot.locationNumber, pdfX, pdfY, { align: 'center', baseline: 'middle' });
        
        if (messagesVisible && dot.message) {
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(fontSize * 1.1); pdf.setTextColor(markerTypeInfo.color);
            pdf.text(dot.message, pdfX, pdfY + radius + (fontSize * 0.5), { align: 'center', baseline: 'top' });
        }
    });
}

function createDetailPage(pdf, dot, sourcePageNum, originalToNewPageMap) {
    const markerTypeInfo = appState.markerTypes[dot.markerType] || { color: '#ff0000', textColor: '#FFFFFF', code: 'UNKNOWN', name: 'Unknown Type' };
    
    pdf.addPage([612, 792], 'portrait');
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 40;
    const contentWidth = pageWidth - (2 * margin);
    let currentY = margin;

    // Back to Map Button
    const buttonWidth = 150;
    const buttonHeight = 30;
    const buttonX = (pageWidth - buttonWidth) / 2;
    pdf.setFillColor(220, 220, 220);
    pdf.setDrawColor(153, 153, 153);
    pdf.setLineWidth(1);
    pdf.roundedRect(buttonX, currentY, buttonWidth, buttonHeight, 5, 5, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text('BACK TO MAP', pageWidth / 2, currentY + 20, { align: 'center' });

    // Use the map to get the correct page number for the link
    const correctMapPage = originalToNewPageMap.get(sourcePageNum);
    if (correctMapPage) {
        pdf.link(buttonX, currentY, buttonWidth, buttonHeight, { pageNumber: correctMapPage });
    }
    
    currentY += 80;

    // Main Content Area (no border)
    const contentInnerMargin = 20;
    let contentY = currentY;
    const contentInnerWidth = contentWidth - (2 * contentInnerMargin);

    // Location ID
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(36);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`LOC# ${dot.locationNumber}`, margin + contentInnerMargin, contentY);
    contentY += 20;

    // Marker Type
    pdf.setFillColor(markerTypeInfo.color);
    pdf.rect(margin + contentInnerMargin, contentY, 20, 20, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(`Marker Type: ${markerTypeInfo.code} - ${markerTypeInfo.name}`, margin + contentInnerMargin + 30, contentY + 14);
    contentY += 40;

    // Message
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Message:', margin + contentInnerMargin, contentY);
    contentY += 20;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    const messageLines = pdf.splitTextToSize(dot.message, contentInnerWidth);
    pdf.text(messageLines, margin + contentInnerMargin, contentY);
    contentY += (messageLines.length * 15) + 20;

    // Notes Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('NOTES:', margin + contentInnerMargin, contentY);
    contentY += 10;
    pdf.setDrawColor(220);
    pdf.roundedRect(margin + contentInnerMargin, contentY, contentInnerWidth, 100, 3, 3, 'S');
    if (dot.notes) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        const notesLines = pdf.splitTextToSize(dot.notes, contentInnerWidth - 10);
        pdf.text(notesLines, margin + contentInnerMargin + 5, contentY + 12);
    }
    contentY += 140;
    
    // Status Checkboxes
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Status:', margin + contentInnerMargin, contentY);
    contentY += 10;

    const checkboxSize = 12;
    const checkboxLabelOffset = 20;

    // Installed Checkbox (always show)
    pdf.setDrawColor(0);
    pdf.rect(margin + contentInnerMargin, contentY, checkboxSize, checkboxSize, 'S');
    if (dot.installed) {
        pdf.setFont('zapfdingbats');
        pdf.text('✓', margin + contentInnerMargin + 2, contentY + 10);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text('Installed', margin + contentInnerMargin + checkboxLabelOffset, contentY + 10);
    
    // Code Required Checkbox (always show)
    let codeRequiredX = margin + contentInnerMargin + 150;
    pdf.setDrawColor(0);
    pdf.rect(codeRequiredX, contentY, checkboxSize, checkboxSize, 'S');
    if (dot.isCodeRequired) {
        pdf.setFont('zapfdingbats');
        pdf.text('✓', codeRequiredX + 2, contentY + 10);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text('Code Required', codeRequiredX + checkboxLabelOffset, contentY + 10);
    
    contentY += 60;

    // Reference Image Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('REFERENCE IMAGE', margin + contentInnerMargin, contentY);
    contentY += 10;
    
    const placeholderWidth = 240;
    const placeholderHeight = 240;
    
    if (markerTypeInfo.designReference) {
        // Draw placeholder border first
        pdf.setDrawColor(200);
        pdf.rect(margin + contentInnerMargin, contentY, placeholderWidth, placeholderHeight, 'S');
        
        // Show the actual reference image, maintaining aspect ratio
        try {
            // Get image properties to calculate aspect ratio
            const imgProps = pdf.getImageProperties(markerTypeInfo.designReference);
            const imgRatio = imgProps.width / imgProps.height;
            const placeholderRatio = placeholderWidth / placeholderHeight;
            
            let scaledWidth, scaledHeight, offsetX, offsetY;
            
            if (imgRatio > placeholderRatio) {
                // Image is wider - scale to fit width
                scaledWidth = placeholderWidth;
                scaledHeight = placeholderWidth / imgRatio;
                offsetX = 0;
                offsetY = (placeholderHeight - scaledHeight) / 2;
            } else {
                // Image is taller - scale to fit height
                scaledHeight = placeholderHeight;
                scaledWidth = placeholderHeight * imgRatio;
                offsetX = (placeholderWidth - scaledWidth) / 2;
                offsetY = 0;
            }
            
            pdf.addImage(
                markerTypeInfo.designReference, 
                'JPEG', 
                margin + contentInnerMargin + offsetX, 
                contentY + offsetY, 
                scaledWidth, 
                scaledHeight
            );
        } catch (error) {
            // If image fails to load, show placeholder text
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(150);
            pdf.text('[Reference image placeholder]', margin + contentInnerMargin + placeholderWidth/2, contentY + placeholderHeight/2, { align: 'center' });
            pdf.setTextColor(0);
        }
    } else {
        // Show placeholder when no image is uploaded
        pdf.setDrawColor(200);
        pdf.setFillColor(224, 224, 224);
        pdf.rect(margin + contentInnerMargin, contentY, placeholderWidth, placeholderHeight, 'FD');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text('[Reference image placeholder]', margin + contentInnerMargin + placeholderWidth/2, contentY + placeholderHeight/2, { align: 'center' });
        pdf.setTextColor(0);
    }
    contentY += placeholderHeight + 20;

    // Footer
    currentY = pageHeight - margin;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text(`Created with Mapping Slayer on ${new Date().toLocaleDateString()}`, pageWidth / 2, currentY, { align: 'center' });
    pdf.text(`Project: ${document.getElementById('project-name').textContent}`, pageWidth / 2, currentY + 12, { align: 'center' });
    const pageLabel = appState.pageLabels.get(sourcePageNum) || '';
    if (pageLabel) {
        pdf.text(`Page: ${pageLabel}`, pageWidth / 2, currentY + 24, { align: 'center' });
    }
}

async function exportToBluebeam() {
    if (!appState.pdfDoc) { 
        alert('Please load a PDF first.'); 
        return;
    }

    const exportBtn = document.getElementById('export-fdf-btn');
    const originalText = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';

    try {
        const activeFilters = getActiveFilters();
        let allVisibleDots = [];
        
        for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
            const dotsOnPage = Array.from(getDotsForPage(pageNum).values());
            const visibleDots = dotsOnPage
                .filter(dot => activeFilters.includes(dot.markerType))
                .map(dot => ({ ...dot, page: pageNum }));
            allVisibleDots.push(...visibleDots);
        }

        if (allVisibleDots.length === 0) {
            alert('No annotations match the current filters. BAX not created.');
            return;
        }

        const baxContent = await createBluebeamBAX(allVisibleDots);
        
        const blob = new Blob([baxContent], { type: 'application/xml' });
        const link = document.createElement('a');
        const mapFileName = document.getElementById('map-file-name').textContent.replace('.pdf', '');
        link.href = URL.createObjectURL(blob);
        link.download = `${mapFileName}_Bluebeam.bax`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        showCSVStatus(`✅ Exported ${allVisibleDots.length} locations for Bluebeam`, true, 5000);

    } catch (error) {
        console.error('Failed to export BAX:', error);
        alert('An error occurred while exporting. Check the console for details.');
        showCSVStatus('❌ Export failed', false, 3000);
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalText;
    }
}

async function createBluebeamBAX(dots) {
    let bax = `<?xml version="1.0" encoding="utf-8"?>
<Document Version="1">
`;

    const dotsByPage = new Map();
    dots.forEach(dot => {
        if (!dotsByPage.has(dot.page)) {
            dotsByPage.set(dot.page, []);
        }
        dotsByPage.get(dot.page).push(dot);
    });

    for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
        const pageIndex = pageNum - 1;
        const dotsOnPage = dotsByPage.get(pageNum) || [];
        const pageLabel = appState.pageLabels.get(pageNum) || pageNum.toString();
        
        const page = await appState.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        const pageWidth = Math.round(viewport.width);
        const pageHeight = Math.round(viewport.height);
        
        bax += `  <Page Index="${pageIndex}">
    <Label>${pageLabel}</Label>
    <Width>${pageWidth}</Width>
    <Height>${pageHeight}</Height>
`;

        dotsOnPage.forEach((dot, index) => {
            const markerType = appState.markerTypes[dot.markerType];
            const parentId = generateBluebeamID();
            const childId = generateBluebeamID();
            const now = new Date().toISOString();
            
            const textContent = dot.locationNumber;
            const textRawData = generateTextBoxRawData(dot.x, dot.y, textContent, pageHeight, markerType.color, markerType.textColor);
            const circleRawData = generateRawDataForCoordinates(dot.x, dot.y, '', pageHeight, markerType.color);
            
            bax += `    <Annotation>
      <Page>${pageLabel}</Page>
      <Contents>${dot.locationNumber}</Contents>
      <ModDate>${now}</ModDate>
      <Color>${markerType.color}</Color>
      <Type>FreeText</Type>
      <ID>${parentId}</ID>
      <TypeInternal>Bluebeam.PDF.Annotations.AnnotationFreeText</TypeInternal>
      <Raw>${textRawData}</Raw>
      <Index>${index * 2 + 1}</Index>
      <Custom>
        <Room_Name>${dot.message}</Room_Name>
        <Room_Number />
        <Notes>${dot.notes || ''}</Notes>
        <Classification />
      </Custom>
      <Subject>${markerType.code} - ${markerType.name}</Subject>
      <CreationDate>${now}</CreationDate>
      <Author>Mapping Slayer</Author>
      <GroupChildren>
        <Child>
          <Page>${pageLabel}</Page>
          <Contents />
          <ModDate>${now}</ModDate>
          <Color>${markerType.color}</Color>
          <Type>Circle</Type>
          <ID>${childId}</ID>
          <TypeInternal>Bluebeam.PDF.Annotations.AnnotationCircle</TypeInternal>
          <Raw>${circleRawData}</Raw>
          <Index>${index * 2}</Index>
          <Custom>
            <Room_Name>${dot.message}</Room_Name>
            <Room_Number />
            <Notes>${dot.notes || ''}</Notes>
            <Classification />
          </Custom>
          <Subject>Ellipse</Subject>
          <CreationDate>${now}</CreationDate>
          <Author>Mapping Slayer</Author>
          <Parent>${parentId}</Parent>
        </Child>
      </GroupChildren>
    </Annotation>
`;
        });

        bax += `  </Page>
`;
    }

    bax += `</Document>`;
    return bax;
}

function generateBluebeamID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function createMessageSchedule() {
    if (!appState.pdfDoc) { alert('Please load a PDF first.'); return; }
    const activeFilters = getActiveFilters(); let allVisibleDots = [];
    for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
        const dotsOnPage = Array.from(getDotsForPage(pageNum).values());
        const visibleDots = dotsOnPage.filter(dot => activeFilters.includes(dot.markerType)).map(dot => ({ ...dot, page: pageNum }));
        allVisibleDots.push(...visibleDots);
    }
    if (allVisibleDots.length === 0) { alert('No annotations match the current filters. CSV not created.'); return; }
    allVisibleDots.sort((a, b) => {
        const markerTypeComparison = a.markerType.localeCompare(b.markerType, undefined, { numeric: true });
        if (markerTypeComparison !== 0) return markerTypeComparison;
        return a.locationNumber.localeCompare(b.locationNumber);
    });
    let csvContent = "MARKER TYPE CODE,MARKER TYPE NAME,MESSAGE,LOCATION NUMBER,MAP PAGE,PAGE LABEL,CODE REQUIRED,INSTALLED\n";
    allVisibleDots.forEach(dot => {
        const typeData = appState.markerTypes[dot.markerType];
        const pageLabel = appState.pageLabels.get(dot.page) || '';
        const row = [
            `"${typeData.code.replace(/"/g, '""')}"`, 
            `"${typeData.name.replace(/"/g, '""')}"`, 
            `"${dot.message.replace(/"/g, '""')}"`, 
            `'${dot.locationNumber}'`, 
            dot.page,
            `"${pageLabel.replace(/"/g, '""')}"`,
            dot.isCodeRequired ? 'YES' : 'NO',
            dot.installed ? 'YES' : 'NO'
        ].join(',');
        csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const mapFileName = document.getElementById('map-file-name').textContent.replace('.pdf', '');
    link.setAttribute("download", `${mapFileName}_MessageSchedule.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function createAnnotatedPDF() {
    if (!appState.pdfDoc) { 
        alert('Please load a PDF first.'); 
        return; 
    }
    document.getElementById('pdf-export-modal').style.display = 'block';
}

async function performPDFExport(exportType) {
    document.getElementById('pdf-export-modal').style.display = 'none';
    
    const createPdfBtn = document.getElementById('create-pdf-btn');
    const originalBtnText = createPdfBtn.textContent;
    createPdfBtn.disabled = true; 
    createPdfBtn.textContent = 'Generating...';
    
    const activeFilters = getActiveFilters(); 
    const messagesVisible = appState.messagesVisible;
    const tempCanvas = document.createElement('canvas'); 
    const tempCtx = tempCanvas.getContext('2d');
    
    try {
        const { jsPDF } = window.jspdf; 
        let outputPdf = null;
        let detailPageNumbers = new Map();
        const originalToNewPageMap = new Map();

        // Create map pages
        for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
            const dotsToDraw = Array.from(getDotsForPage(pageNum).values()).filter(dot => activeFilters.includes(dot.markerType));
            if (dotsToDraw.length === 0) continue;
            createPdfBtn.textContent = `Main Page ${pageNum}/${appState.totalPages}...`;
            
            const page = await appState.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: appState.pdfScale });
            tempCanvas.width = viewport.width; 
            tempCanvas.height = viewport.height;
            await page.render({ canvasContext: tempCtx, viewport: viewport }).promise;
            const imgData = tempCanvas.toDataURL('image/jpeg', 0.9);
            
            if (!outputPdf) {
                outputPdf = new jsPDF({ 
                    orientation: viewport.width > viewport.height ? 'landscape' : 'portrait', 
                    unit: 'pt', 
                    format: [viewport.width, viewport.height] 
                });
            } else { 
                outputPdf.addPage([viewport.width, viewport.height], viewport.width > viewport.height ? 'landscape' : 'portrait'); 
            }
            
            const newPageNumForMap = outputPdf.internal.getNumberOfPages();
            originalToNewPageMap.set(pageNum, newPageNumForMap);

            outputPdf.addImage(imgData, 'JPEG', 0, 0, viewport.width, viewport.height);
            drawLegendWithJsPDF(outputPdf, dotsToDraw);
            drawDotsWithJsPDF(outputPdf, dotsToDraw, messagesVisible);
        }
        
        // Create detail pages only if requested
        if (exportType === 'with-details') {
            createPdfBtn.textContent = 'Creating detail pages...';
            for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
                const dotsToDraw = Array.from(getDotsForPage(pageNum).values()).filter(dot => activeFilters.includes(dot.markerType));
                for (const dot of dotsToDraw) {
                    const detailPageNum = outputPdf.internal.getNumberOfPages() + 1;
                    detailPageNumbers.set(dot.internalId, detailPageNum);
                    createDetailPage(outputPdf, dot, pageNum, originalToNewPageMap);
                }
            }
            
            // Add hyperlinks only if we have detail pages
            createPdfBtn.textContent = 'Adding hyperlinks...';
            for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
                const dotsToDraw = Array.from(getDotsForPage(pageNum).values()).filter(dot => activeFilters.includes(dot.markerType));
                if (dotsToDraw.length === 0) continue;
                
                const mapPageNum = originalToNewPageMap.get(pageNum);
                if (mapPageNum) {
                    outputPdf.setPage(mapPageNum);
                    
                    dotsToDraw.forEach(dot => {
                        const effectiveMultiplier = appState.dotSize * 2;
                        const radius = (20 * effectiveMultiplier) / 2;
                        const detailPageNum = detailPageNumbers.get(dot.internalId);
                        
                        if (detailPageNum) {
                            outputPdf.link(
                                dot.x - radius, 
                                dot.y - radius, 
                                radius * 2, 
                                radius * 2, 
                                { pageNumber: detailPageNum }
                            );
                        }
                    });
                }
            }
        }
        
        if (outputPdf) {
            const mapFileName = document.getElementById('map-file-name').textContent.replace('.pdf', '');
            const suffix = exportType === 'with-details' ? '_interactive' : '_map_only';
            outputPdf.save(`${mapFileName}${suffix}.pdf`);
        } else { 
            alert('No annotations match the current filters. PDF not created.'); 
        }
    } catch (error) {
        console.error('Failed to create PDF:', error);
        alert('An error occurred while creating the PDF. Check the console for details.');
    } finally {
        createPdfBtn.disabled = false; 
        createPdfBtn.textContent = originalBtnText; 
        tempCanvas.remove();
    }
}
