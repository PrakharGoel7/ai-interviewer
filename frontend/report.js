const summaryCard = document.getElementById("summary-card");
const titleEl = document.getElementById("case-title");
const typeEl = document.getElementById("case-type");
const industryEl = document.getElementById("case-industry");
const completedEl = document.getElementById("case-completed");
const durationEl = document.getElementById("case-duration");
const bandEl = document.getElementById("overall-band");
const execSummaryEl = document.getElementById("executive-summary");
const rubricList = document.getElementById("rubric-list");

function renderSummary(report) {
  titleEl.textContent = report.case.title;
  typeEl.textContent = report.case.type;
  industryEl.textContent = report.case.industry;
  completedEl.textContent = report.case.completedAt;
  durationEl.textContent = Math.max(1, Math.round(report.case.durationSec / 60));
  bandEl.textContent = report.overall.band;
  execSummaryEl.textContent = report.overall.executiveSummary;
}

function createEvidenceSection(title, items) {
  const section = document.createElement("div");
  section.className = "evidence-section";
  const heading = document.createElement("h4");
  heading.textContent = title;
  section.appendChild(heading);
  const list = document.createElement("ul");
  if (items && items.length) {
    items.slice(0, 3).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item.text;
      list.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No notes captured.";
    list.appendChild(li);
  }
  section.appendChild(list);
  return section;
}

function renderRubrics(rubrics) {
  let openKey = null;
  rubrics.forEach((rubric) => {
    const item = document.createElement("div");
    item.className = "rubric-item";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "rubric-toggle";
    toggle.setAttribute("aria-expanded", "false");

    const info = document.createElement("div");
    info.className = "rubric-info";
    const title = document.createElement("p");
    title.className = "rubric-title";
    title.textContent = rubric.title;
    info.appendChild(title);

    const score = document.createElement("span");
    score.className = "rubric-score";
    score.textContent = `${rubric.score.toFixed(1)} / 5`;

    const chevron = document.createElement("span");
    chevron.className = "chevron";

    toggle.appendChild(info);
    toggle.appendChild(score);
    toggle.appendChild(chevron);

    const drawer = document.createElement("div");
    drawer.className = "evidence-drawer";
    drawer.appendChild(createEvidenceSection("Strengths", rubric.strengths));
    drawer.appendChild(createEvidenceSection("Areas for Improvement", rubric.improvements));

    toggle.addEventListener("click", () => {
      if (openKey === rubric.key) {
        item.classList.remove("open");
        drawer.style.display = "none";
        toggle.setAttribute("aria-expanded", "false");
        openKey = null;
        return;
      }
      Array.from(rubricList.children).forEach((child) => {
        child.classList.remove("open");
        const childDrawer = child.querySelector(".evidence-drawer");
        const childToggle = child.querySelector(".rubric-toggle");
        if (childDrawer && childToggle) {
          childDrawer.style.display = "none";
          childToggle.setAttribute("aria-expanded", "false");
        }
      });
      item.classList.add("open");
      drawer.style.display = "block";
      toggle.setAttribute("aria-expanded", "true");
      openKey = rubric.key;
    });

    item.appendChild(toggle);
    item.appendChild(drawer);
    rubricList.appendChild(item);
  });
}

async function fetchReport() {
  try {
    const resp = await fetch("/api/report");
    if (!resp.ok) {
      throw new Error("Report not ready");
    }
    const data = await resp.json();
    renderSummary(data);
    renderRubrics(data.rubrics || []);
  } catch (err) {
    execSummaryEl.textContent = "Report not available yet. Please return after completing a case.";
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", fetchReport);
