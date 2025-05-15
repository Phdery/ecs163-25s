const svg = d3.select("svg");
let globalData;

// Load data, render initially, and bind resize event
d3.csv("data/ds_salaries.csv", d => ({
  year: +d.work_year,
  exp: d.experience_level,
  salary: +d.salary_in_usd,
  remote: +d.remote_ratio,
  size: +{"S":1,"M":2,"L":3}[d.company_size],
  sizeLabel: d.company_size
}))
.then(data => {
  globalData = data;
  render();
  window.addEventListener("resize", render);
})
.catch(err => console.error("Failed to load data:", err));


// Responsive design: automatically redraws when window size changes
function render() {
  // Clear all existing content
  svg.selectAll("*").remove();
  // Get current window dimensions
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Layout parameters for the three visualizations
  const histHeight = height * 0.3;
  const bottomHeight = height - histHeight;
  const panelWidth = width * 0.5;

  const marginHist = { top: 60, right: 20, bottom: 50, left: 60 };
  const marginStream = { top: 60, right: 20, bottom: 50, left: 60 };
  const marginSankey = { top: 60, right: 20, bottom: 50, left: 60 };

  const histW = width - marginHist.left - marginHist.right;
  const histH = histHeight - marginHist.top - marginHist.bottom;
  const streamW = panelWidth - marginStream.left - marginStream.right;
  const streamH = bottomHeight- marginStream.top - marginStream.bottom;
  const sankeyW = panelWidth - marginSankey.left - marginSankey.right;
  const sankeyH = bottomHeight- marginSankey.top - marginSankey.bottom;

  // Create three containers for the visualizations
  const gHist = svg.append("g")
    .attr("transform", `translate(${marginHist.left},${marginHist.top})`);
  const gStream = svg.append("g")
    .attr("transform", `translate(${marginStream.left},${histHeight + marginStream.top})`);
  const gSankey = svg.append("g")
    .attr("transform", `translate(${panelWidth + marginSankey.left},${histHeight + marginSankey.top})`);

  // Call drawing functions for each visualization
  drawHistogram(globalData, gHist, histW, histH);
  drawStreamGraph(globalData, gStream, streamW, streamH);
  drawSankey(globalData, gSankey, sankeyW, sankeyH);
}


// Histogram: Salary Distribution visualization
function drawHistogram(data, gHist, histW, histH) {
  // Set domain from min to max salary and map to available width
  // d3.scaleLinear() creates a linear scale for mapping salary values to pixel positions on the x-axis. The domain is set to the min and max salary in the data, and the range is the width of the histogram area.
  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.salary)).nice()
    .range([0, histW]);

  // Create histogram bins based on salary data
  // d3.histogram() creates a histogram generator that takes the domain and thresholds (number of bins) to create an array of bins. Each bin contains the count of data points that fall within its range.
  const bins = d3.histogram()
    .domain(x.domain())
    .thresholds(x.ticks(40))
    (data.map(d => d.salary));

  // Create a group for the histogram bars
  // The histogram bars are drawn using rectangles, and the y-axis is scaled based on the maximum count of data points in any bin.
  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, b => b.length)]).nice()
    .range([histH, 0]);

  // Draw histogram bars
  gHist.selectAll("rect")
    .data(bins)
    .enter().append("rect")
      .attr("x", d => x(d.x0) + 1) 
      .attr("y", d => y(d.length))
      .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr("height", d => histH - y(d.length))
      .attr("fill", "steelblue");

  // Create X-axis with label
  // d3.axisBottom() generates a bottom axis for the histogram, and the label is positioned below the axis.
  gHist.append("g")
    .attr("transform", `translate(0,${histH})`)
    .call(d3.axisBottom(x))
    .append("text")
      .attr("class","axis-label")
      .attr("x", histW/2).attr("y", 35)
      .text("Salary (USD)");

  // Create Y-axis with label
  // d3.axisLeft() generates a left axis for the histogram, and the label is rotated for vertical text.
  gHist.append("g")
    .call(d3.axisLeft(y))
    .append("text")
      .attr("class","axis-label")
      .attr("transform","rotate(-90)")
      .attr("x", -histH/2).attr("y", -45)
      .text("Count");

  // Add chart title
  gHist.append("text")
      .attr("class","title")
      .attr("x", histW/2)
      .attr("y", -20)
      .text("Salary Distribution (USD)");
}


// Stream Graph: Employees by Experience Level Over Time
function drawStreamGraph(data, gStream, streamW, streamH) {
  // Set up the stream graph layout
  // d3.nest() is used to group the data by year and experience level, and rollup() calculates the count of employees for each group.
  const nest = d3.nest()
    .key(d => d.year)
    .key(d => d.exp)
    .rollup(v => v.length)
    .map(data);

  const years  = Array.from(new Set(data.map(d => d.year))).sort();
  const levels = ["EN","MI","SE","EX"];
  
  // Reshape data for d3.stack() - each row is one year
  const stackData = years.map(yr => {
    const m = nest.get(yr) || new Map();
    const row = { year: yr };
    levels.forEach(l => row[l] = m.get(l) || 0);
    return row;
  });

  // Create a stack generator for the stream graph
  // d3.stack() generates the data for the stream graph, and d3.stackOffsetWiggle() creates a smooth curve for the layers.
  const stackGen = d3.stack().keys(levels).offset(d3.stackOffsetWiggle);
  const layers   = stackGen(stackData);

  // Create scales for the stream graph
  // d3.scaleLinear() is used to map the years to the x-axis and the employee counts to the y-axis. The y-axis is inverted to create the stream effect.
  const x = d3.scaleLinear().domain(d3.extent(years)).range([0, streamW]);
  const y = d3.scaleLinear()
    .domain([
      d3.min(layers, lyr => d3.min(lyr, d => d[0])),
      d3.max(layers, lyr => d3.max(lyr, d => d[1]))
    ])
    .range([streamH, 0]);

  // Create a color scale for the experience levels
  // d3.scaleOrdinal() is used to assign colors to each experience level, and d3.schemeCategory10 provides a set of distinct colors.
  // The area generator is used to create the shapes of the stream layers.
  const expColor = d3.scaleOrdinal().domain(levels).range(d3.schemeCategory10);
  const area = d3.area()
    .x(d => x(d.data.year))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]));

  // Draw stream layers
  gStream.selectAll("path")
    .data(layers)
    .enter().append("path")
      .attr("d", area)
      .attr("fill", d => expColor(d.key));

  // Create X-axis with label
  // d3.axisBottom() generates a bottom axis for the histogram, and the label is positioned below the axis.
  gStream.append("g")
      .attr("transform", `translate(0,${streamH})`)
      .call(d3.axisBottom(x).ticks(years.length).tickFormat(d3.format("d")))
    .append("text")
      .attr("class","axis-label")
      .attr("x", streamW/2).attr("y", 35)
      .text("Year");

  // Create Y-axis with label
  // d3.axisLeft() generates a left axis for the histogram, and the label is rotated for vertical text.
  gStream.append("g")
      .call(d3.axisLeft(y))
    .append("text")
      .attr("class","axis-label")
      .attr("transform","rotate(-90)")
      .attr("x", -streamH/2).attr("y", -45)
      .text("Count");

  // Add chart title
  gStream.append("text")
      .attr("class","title")
      .attr("text-anchor","middle") 
      .attr("x", streamW/2).attr("y", -20)
      .text("Employees by Experience Level Over Time");

  // Define full labels for legend
  const labelsFull = {
    EN: "EN (Entry‑level)",
    MI: "MI (Mid‑level)",
    SE: "SE (Senior‑level)",
    EX: "EX (Executive‑level)"
  };
  
  // Create legend for experience levels
  const legend = gStream.append("g")
    .attr("class","legend")
    .attr("transform", `translate(10,0)`);
  levels.forEach((l,i) => {
    const row = legend.append("g").attr("transform", `translate(0,${i*20})`);
    row.append("rect").attr("width",12).attr("height",12).attr("fill", expColor(l));
    row.append("text").attr("x",18).attr("y",10).text(labelsFull[l]);
  });
}


// Sankey Diagram: Experience → Company Size → Remote Ratio
function drawSankey(data, gSankey, sankeyW, sankeyH) {
  const expLevels = Array.from(new Set(data.map(d => d.exp)));
  const sizes = Array.from(new Set(data.map(d => d.sizeLabel)));
  const remotes = Array.from(new Set(data.map(d => d.remote))).sort((a,b)=>a-b);

  // Define nodes for the Sankey diagram
  const nodes = [
    ...expLevels.map(e => ({ id:`exp_${e}`, name:e, type:"exp"})),
    ...sizes.map(s => ({ id:`size_${s}`, name:`Size ${s}`, type:"size"})),
    ...remotes.map(r => ({ id:`rem_${r}`, name:`Remote ${r}%`, type:"remote"}))
  ];

  // Create links between nodes
  const links = [];
  expLevels.forEach(e => sizes.forEach(s => {
    const v = data.filter(d => d.exp===e && d.sizeLabel===s).length;
    if (v>0) links.push({ source:`exp_${e}`, target:`size_${s}`, value:v });
  }));
  sizes.forEach(s => remotes.forEach(r => {
    const v = data.filter(d => d.sizeLabel===s && d.remote===r).length;
    if (v>0) links.push({ source:`size_${s}`, target:`rem_${r}`, value:v });
  }));

  // Configure Sankey generator
  // d3.sankey() creates a Sankey diagram generator, and the nodeId() function specifies how to identify nodes. The nodeWidth() and nodePadding() functions control the appearance of the nodes.
  // The extent() function defines the available space for the diagram.
  const sankeyGen = d3.sankey()
    .nodeId(d => d.id)
    .nodeWidth(15)
    .nodePadding(10)
    .extent([[0,0],[sankeyW,sankeyH]]);

  // Generate Sankey layout
  const graph = sankeyGen({
    nodes: nodes.map(d => ({ ...d })),
    links: links.map(d => ({ ...d }))
  });

  // Create color scales for different node types
  // d3.scaleOrdinal() is used to assign colors to each node type, and d3.schemeCategory10 provides a set of distinct colors.
  const expColor    = d3.scaleOrdinal().domain(expLevels).range(d3.schemeCategory10);
  const sizeColor   = d3.scaleOrdinal().domain(sizes).range(d3.schemeSet2);
  const remoteColor = d3.scaleOrdinal().domain(remotes).range(d3.schemeSet3);

  // Draw Sankey links
  // The links are drawn as paths using d3.sankeyLinkHorizontal() to create a horizontal link between nodes. The stroke width is based on the value of the link.
  // The color of the links is determined by the source node type.
  // d3.sankeyLinkHorizontal() creates a horizontal link between nodes, and the stroke width is based on the value of the link.
  gSankey.append("g").attr("class","links")
    .selectAll("path")
    .data(graph.links)
    .enter().append("path")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("stroke-width", d => Math.max(1, d.width))
      .attr("stroke", d => {
        if (d.source.type==="exp")   return expColor(d.source.name);
        if (d.source.type==="size")  return sizeColor(d.source.name);
        return remoteColor(d.target.name);
      })
      .attr("fill","none")
      .attr("stroke-opacity", 0.8);

  // Draw Sankey nodes
  const node = gSankey.append("g").attr("class","nodes")
    .selectAll("g")
    .data(graph.nodes)
    .enter().append("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

  // Add node rectangles
  node.append("rect")
    .attr("width", sankeyGen.nodeWidth())
    .attr("height", d => d.y1 - d.y0)
    .attr("fill", d => {
      if (d.type==="exp")  return expColor(d.name);
      if (d.type==="size") return sizeColor(d.name);
      return remoteColor(d.name);
    })
    .attr("stroke","#000");

  // Add node labels
  node.append("text")
    .attr("x", -6)
    .attr("y", d => (d.y1 - d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor","end")
    .text(d => d.name);

  // Add chart title
  gSankey.append("text")
    .attr("class","title")
    .attr("text-anchor","middle")
    .attr("x", sankeyW/2)
    .attr("y", -20)
    .text("Sankey Flow: Experience → Company Size → Remote Ratio");
}
