const needsForm = document.getElementById("needsForm");
const needsStatus = document.getElementById("needsStatus");
const needsSubmit = document.getElementById("needsSubmit");
const needsPlanResult = document.getElementById("needsPlanResult");

const GUIDE_MAP = {
  renting: {
    title: "Renting in China",
    copy: "Start with the renting guide to understand viewings, deposits, contracts, payments, and common pitfalls before you compare options.",
    href: "rent.html",
    cta: "Open the renting guide →"
  },
  healthcare: {
    title: "How a hospital visit works in China",
    copy: "Use the healthcare guide to understand registration, departments, payment, and what to prepare before a non-emergency hospital visit.",
    href: "healthcare-guide.html",
    cta: "Open the healthcare guide →"
  },
  payments: {
    title: "Money & payments in China",
    copy: "Review the free payment guide for international-card limits, mobile wallets, fees, and useful backup options.",
    href: "guides.html#money",
    cta: "Open the payment guide →"
  },
  moving: {
    title: "Plan your move to China",
    copy: "Use the newcomer path to work through the practical tasks that are easiest to handle before or just after arrival.",
    href: "moving-to-shanghai.html",
    cta: "Open the moving guide →"
  }
};

const SUPPORT_MAP = {
  house_finding: {
    title: "House Finding Support",
    price: "US$150",
    copy: "For a structured rental search, local verification, an English comparison, and first-round viewing coordination.",
    href: "personal-support-details.html#house-finding"
  },
  task_based_support: {
    title: "Task-Based Support",
    price: "US$20 / US$50 / US$80",
    copy: "For a clearly bounded local task that needs Chinese-language research, provider contact, comparison, or coordination.",
    href: "personal-support-details.html#tasks"
  },
  phone_call: {
    title: "One Chinese Phone Call",
    price: "US$10",
    copy: "For one routine Chinese-language call of up to 15 minutes when you need a specific question asked or information confirmed.",
    href: "personal-support-details.html#calls"
  },
  seven_day_qa: {
    title: "7-Day Q&A Support",
    price: "US$30",
    copy: "For up to 15 questions across seven days when you mainly need explanations, local context, or help deciding what to do next.",
    href: "personal-support-details.html#questions"
  }
};

function getAcquisitionSource() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("ref") || "direct").trim().slice(0, 80);
}

function trackSupportClick(plan, payload) {
  const eventWebhookUrl = (window.EVENT_WEBHOOK_URL || "").trim();
  if (!eventWebhookUrl || !plan || !plan.support_key || plan.support_key === "none") return;

  const eventPayload = {
    request_id: payload.request_id || "",
    event_type: "support_click",
    category: plan.category || "other",
    support_key: plan.support_key,
    city: payload.city || "",
    source: "support-planner"
  };

  // Do not delay navigation. keepalive lets the browser finish the request
  // even when the user immediately opens the support-details page.
  fetch(eventWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eventPayload),
    keepalive: true
  }).catch((error) => {
    console.warn("Support click tracking failed:", error);
  });
}

function createRequestId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  // Fallback for older browsers that do not support crypto.randomUUID().
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildNeedsPayload(formElement) {
  const formData = new FormData(formElement);
  const consent = formData.get("consent") === "on";

  return {
    request_id: createRequestId(),
    submittedAt: new Date().toISOString(),
    source: "adapt-to-china-support-planner",
    acquisition_source: getAcquisitionSource(),
    source_page: window.location.pathname,
    name: (formData.get("name") || "").trim(),
    email: (formData.get("email") || "").trim(),
    city: (formData.get("city") || "").trim(),
    timing: formData.get("timing") || "",
    support_preference: formData.get("support_preference") || "",
    details: (formData.get("details") || "").trim(),
    consent
  };
}

function setupNeedsWizard() {
  if (!needsForm) return;

  const steps = Array.from(needsForm.querySelectorAll(".needs-step"));
  const progressItems = Array.from(needsForm.querySelectorAll("[data-progress]"));
  let currentStep = 1;

  function stepElement(stepNumber) {
    return needsForm.querySelector(`[data-step="${stepNumber}"]`);
  }

  function validateStep(stepNumber) {
    const step = stepElement(stepNumber);
    if (!step) return true;
    const fields = Array.from(step.querySelectorAll("input, select, textarea"));
    for (const field of fields) {
      if (field.type === "hidden" || field.tabIndex === -1) continue;
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    return true;
  }

  function showStep(stepNumber, options = {}) {
    currentStep = stepNumber;
    steps.forEach((step) => {
      const active = Number(step.dataset.step) === stepNumber;
      step.hidden = !active;
      step.classList.toggle("is-active", active);
    });
    progressItems.forEach((item) => {
      const n = Number(item.dataset.progress);
      item.classList.toggle("is-active", n === stepNumber);
      item.classList.toggle("is-complete", n < stepNumber);
    });

    if (options.focus !== false) {
      const activeStep = stepElement(stepNumber);
      const firstField = activeStep && activeStep.querySelector("textarea, input:not([type='hidden']):not([tabindex='-1']), select");
      if (firstField) {
        window.setTimeout(() => firstField.focus({ preventScroll: true }), 80);
      }
    }
    if (options.scroll !== false) {
      const card = needsForm.getBoundingClientRect();
      if (card.top < 90 || card.top > window.innerHeight * 0.55) {
        needsForm.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  needsForm.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!validateStep(currentStep)) return;
      showStep(Number(button.dataset.next));
    });
  });

  needsForm.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => showStep(Number(button.dataset.back)));
  });

  needsForm._showNeedsStep = showStep;
  showStep(1, { focus: false, scroll: false });
}

function titleForCategory(category) {
  const titles = {
    housing: "A clearer housing plan.",
    healthcare: "A clearer healthcare plan.",
    payments: "A clearer payment plan.",
    local_service: "A clearer local-service plan.",
    phone_call: "A clearer communication plan.",
    general: "A clearer next step.",
    other: "A clearer next step."
  };
  return titles[category] || "A clearer next step.";
}

function urgencyLabel(urgency) {
  const labels = { urgent: "TIME-SENSITIVE", soon: "SOON", flexible: "FLEXIBLE" };
  return labels[urgency] || "PERSONALIZED";
}

function renderPlan(plan, payload) {
  if (!needsPlanResult) return;

  const resultTitle = document.getElementById("needsResultTitle");
  const resultSummary = document.getElementById("needsResultSummary");
  const resultStatus = document.getElementById("needsResultStatus");
  const resultSteps = document.getElementById("needsResultSteps");
  const guideCard = document.getElementById("needsGuideCard");
  const supportCard = document.getElementById("needsSupportCard");
  const selfServeCard = document.getElementById("needsSelfServeCard");

  resultTitle.textContent = titleForCategory(plan.category);
  resultSummary.textContent = plan.summary || "Here is a practical starting point based on what you shared.";
  resultStatus.textContent = urgencyLabel(plan.urgency);

  resultSteps.innerHTML = "";
  const steps = Array.isArray(plan.next_steps) ? plan.next_steps.slice(0, 3) : [];
  steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    resultSteps.appendChild(li);
  });

  const guide = GUIDE_MAP[plan.guide_key];
  if (guide) {
    document.getElementById("needsGuideTitle").textContent = guide.title;
    document.getElementById("needsGuideCopy").textContent = guide.copy;
    const guideLink = document.getElementById("needsGuideLink");
    guideLink.href = guide.href;
    guideLink.textContent = guide.cta;
    guideCard.hidden = false;
  } else {
    guideCard.hidden = true;
  }

  const support = SUPPORT_MAP[plan.support_key];
  if (support) {
    document.getElementById("needsSupportTitle").textContent = support.title;
    document.getElementById("needsSupportPrice").textContent = support.price;
    document.getElementById("needsSupportCopy").textContent = support.copy;
    const supportLink = document.getElementById("needsSupportLink");
    supportLink.href = support.href;
    supportLink.onclick = () => trackSupportClick(plan, payload);
    supportCard.hidden = false;
    selfServeCard.hidden = true;
  } else {
    const supportLink = document.getElementById("needsSupportLink");
    if (supportLink) supportLink.onclick = null;
    supportCard.hidden = true;
    selfServeCard.hidden = false;
  }

  const copyButton = document.getElementById("needsCopyRequest");
  if (copyButton && support) {
    copyButton.onclick = async () => {
      const message = [
        "Hi Martin, I used the Adapt to China Support Planner.",
        "",
        `City: ${payload.city || "Not specified"}`,
        `Timing: ${payload.timing || "Not specified"}`,
        `Planner summary: ${plan.summary || ""}`,
        `Suggested support: ${support.title}`,
        "",
        `My original situation: ${payload.details || ""}`,
        "",
        "Could you let me know whether this support fits and what the next step would be?"
      ].join("\n");
      try {
        await navigator.clipboard.writeText(message);
        copyButton.textContent = "Copied — WeChat ID: martinzhong26";
        window.setTimeout(() => { copyButton.textContent = "Copy a message for Martin"; }, 3500);
      } catch (error) {
        console.error(error);
        copyButton.textContent = "WeChat ID: martinzhong26";
      }
    };
  }

  needsForm.hidden = true;
  needsPlanResult.hidden = false;
  needsPlanResult.scrollIntoView({ behavior: "smooth", block: "start" });
}

setupNeedsWizard();

if (needsForm) {
  needsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!needsForm.checkValidity()) {
      const invalid = needsForm.querySelector(":invalid");
      const invalidStep = invalid && invalid.closest(".needs-step");
      if (invalidStep && invalidStep.dataset.step && needsForm._showNeedsStep) {
        needsForm._showNeedsStep(Number(invalidStep.dataset.step), { focus: false });
      }
      needsForm.reportValidity();
      return;
    }

    const honeypot = document.getElementById("needs-company");
    if (honeypot && honeypot.value.trim()) {
      needsForm.reset();
      needsStatus.textContent = "Thanks. Your request has been received.";
      return;
    }

    const webhookUrl = (window.NEEDS_WEBHOOK_URL || "").trim();
    if (!webhookUrl) {
      needsStatus.innerHTML = 'This planner is not connected yet. Please use <a href="answers.html">Personal Support</a> for now.';
      return;
    }

    const payload = buildNeedsPayload(needsForm);
    needsSubmit.disabled = true;
    needsSubmit.textContent = "Building your plan...";
    needsStatus.textContent = "This usually takes a few seconds.";

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const plan = await response.json();
      if (!plan || typeof plan !== "object" || !plan.category || !Array.isArray(plan.next_steps)) {
        throw new Error("Planner returned an unexpected response.");
      }

      renderPlan(plan, payload);
    } catch (error) {
      console.error(error);
      needsStatus.innerHTML = 'I could not build the plan just now. Please try again, or use <a href="answers.html#contact">Personal Support</a> if you need a human reply.';
    } finally {
      needsSubmit.disabled = false;
      needsSubmit.textContent = "Get my next step →";
    }
  });
}

const needsStartOver = document.getElementById("needsStartOver");
if (needsStartOver && needsForm && needsPlanResult) {
  needsStartOver.addEventListener("click", () => {
    needsForm.reset();
    needsPlanResult.hidden = true;
    needsForm.hidden = false;
    needsStatus.textContent = "";
    if (needsForm._showNeedsStep) needsForm._showNeedsStep(1, { focus: true, scroll: false });
    needsForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

(function setupMobileNav(){
  const burger = document.querySelector('.nav-burger');
  const links = document.getElementById('nav-links');
  if (!burger || !links) return;
  burger.addEventListener('click', function(){
    const open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();
