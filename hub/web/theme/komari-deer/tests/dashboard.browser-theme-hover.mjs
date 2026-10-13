async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const canvas = page.locator('#dashboard-map canvas');
  await canvas.waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(0, 0);
  const rotation = () => canvas.getAttribute('data-rotation');
  const before = await rotation();
  await page.waitForTimeout(200);
  check(await rotation() !== before, 'Default rotation stopped');
  const box = await canvas.boundingBox();
  // Hong Kong uses the production small-territory location, distinct from mainland China.
  const center = Number(await rotation());
  const lon = (114.17 - center) * Math.PI / 180, lat = 22.32 * Math.PI / 180, tilt = 15 * Math.PI / 180;
  const x = (48 + Math.cos(lat) * Math.sin(lon) * 45) / 96;
  const y = (48 - (Math.sin(lat) * Math.cos(tilt) - Math.cos(lat) * Math.cos(lon) * Math.sin(tilt)) * 45) / 96;
  const historyBefore = page.dashboardQA.requests.filter(r=>r.method==='common:getRecords').length;
  await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
  await page.locator('.pixel-globe__hover').waitFor();
  const text = await page.locator('.pixel-globe__hover').innerText();
  check(text.includes('Hong Kong') && text.includes('95%') && text.includes('92%'), 'Hover node data missing');
  const hovered = await rotation();
  await page.waitForTimeout(4500); // Live polling must not resume rotation underneath the pointer.
  check(await rotation() === hovered, 'Hover pause lost after live refresh');
  await page.locator('.pixel-globe__hover a').first().hover();
  await page.waitForTimeout(200);
  check(await rotation() === hovered, 'Moving into popup resumed globe');
  check(page.dashboardQA.requests.filter(r=>r.method==='common:getRecords').length===historyBefore, 'Hover loaded history');
  await page.mouse.move(0,0);
  await page.locator('.pixel-globe__hover').waitFor({state:'hidden'});
  await page.waitForTimeout(200);
  check(await rotation() !== hovered, 'Leaving hover did not resume');
  await page.getByRole('button',{name:'Night mode',exact:true}).click();
  await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
  await page.waitForTimeout(150);
  const dark = await canvas.evaluate(element=>{
    const pixels=element.getContext('2d').getImageData(0,0,element.width,element.height).data;
    let green=0;
    for(let i=0;i<pixels.length;i+=4) if(pixels[i]===56&&pixels[i+1]===239&&pixels[i+2]===131) green++;
    return {background:getComputedStyle(document.body).getPropertyValue('--background').trim(),green};
  });
  check(dark.background==='#141413' && dark.green>0,'Dark palette or vivid green canvas did not repaint');
  await page.evaluate(()=>history.replaceState(null,'','/'));
  await page.reload();
  await canvas.waitFor();
  await page.waitForTimeout(500);
  check(await page.evaluate(()=>document.documentElement.classList.contains('dark')), 'Appearance did not persist after reload');
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1000});
    check(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),`Night mode overflow at ${width}`);
  }
  await page.getByRole('button',{name:'Day mode',exact:true}).click();
  await page.waitForFunction(()=>document.documentElement.classList.contains('light'));
  check(!page.dashboardQA.requests.some(r=>r.method.startsWith('admin:')), 'Personal appearance wrote global settings');
  check(page.dashboardQA.errors.length===0, `Browser errors: ${page.dashboardQA.errors}`);
  return {hoverDetails:true,pausedAcrossLiveRefresh:true,popupAccessible:true,leaveResumes:true,noHoverHistory:true,dark,themePersists:true,widths:[320,390,768,1440],errors:[]};
}
