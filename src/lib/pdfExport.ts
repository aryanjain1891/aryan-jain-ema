import jsPDF from 'jspdf';

interface ClaimData {
  claim_number: string;
  policy_number: string;
  incident_type: string;
  incident_date: string;
  description: string;
  location: string;
  status: string;
  severity_level: string;
  confidence_score: number;
  routing_decision: string;
  ai_assessment: any;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_vin: string;
  vehicle_license_plate: string;
  vehicle_ownership_status: string;
  vehicle_odometer: number;
  vehicle_purchase_date: string;
  created_at: string;
}

interface ClaimQuestion {
  question: string;
  answer: string | null;
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatRouting = (routing: string) => {
  const labels: Record<string, string> = {
    straight_through: 'Straight Through',
    junior_adjuster: 'Junior Adjuster',
    senior_adjuster: 'Senior Adjuster',
    specialist: 'Specialist',
    fraud_investigation: 'Fraud Investigation',
  };
  return labels[routing] || routing || 'Pending';
};

const formatSeverity = (severity: string) => {
  const labels: Record<string, string> = {
    low: 'Low Severity',
    medium: 'Medium Severity',
    high: 'High Severity',
    critical: 'Critical Severity',
    fraudulent: 'Fraudulent',
    invalid_images: 'Invalid Images',
  };
  return labels[severity] || severity || 'Pending Assessment';
};

export const generateClaimPDF = (claim: ClaimData, questions: ClaimQuestion[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const footerMargin = 20; // Reserve space for footer
  const contentWidth = pageWidth - margin * 2;
  const maxContentY = pageHeight - footerMargin;
  let yPos = 20;

  const checkPageBreak = (requiredHeight: number) => {
    if (yPos + requiredHeight > maxContentY) {
      doc.addPage();
      yPos = 20;
    }
  };

  const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 0.5;
    const textHeight = lines.length * lineHeight + 4;
    
    checkPageBreak(textHeight);
    
    doc.text(lines, margin, yPos);
    yPos += textHeight;
  };

  const addSectionHeader = (title: string) => {
    checkPageBreak(20); // Header needs ~20px
    yPos += 5;
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, yPos - 4, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 3, yPos + 2);
    doc.setTextColor(0, 0, 0);
    yPos += 12;
  };

  const addField = (label: string, value: string | number | null | undefined) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const valueText = value?.toString() || 'N/A';
    const labelWidth = doc.getTextWidth(`${label}: `);
    const valueLines = doc.splitTextToSize(valueText, contentWidth - labelWidth - 5);
    const fieldHeight = valueLines.length * 4 + 3;
    
    checkPageBreak(fieldHeight);
    
    doc.text(`${label}:`, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(valueLines, margin + labelWidth + 2, yPos);
    yPos += fieldHeight;
  };

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Claim Report', margin, 18);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Claim #${claim.claim_number}`, margin, 28);
  doc.setTextColor(0, 0, 0);
  yPos = 45;

  // Summary badges
  doc.setFontSize(10);
  addField('Status', claim.status?.toUpperCase() || 'SUBMITTED');
  addField('Severity', formatSeverity(claim.severity_level));
  addField('Routing Decision', formatRouting(claim.routing_decision));
  addField('Confidence Score', claim.confidence_score ? `${Math.round(claim.confidence_score * 100)}%` : 'N/A');
  addField('Submitted', formatDate(claim.created_at));

  // Incident Details
  addSectionHeader('INCIDENT DETAILS');
  addField('Incident Type', claim.incident_type?.replace('_', ' '));
  addField('Incident Date', formatDate(claim.incident_date));
  addField('Location', claim.location);
  addField('Description', claim.description);

  // Vehicle Information
  addSectionHeader('VEHICLE INFORMATION');
  addField('Make', claim.vehicle_make);
  addField('Model', claim.vehicle_model);
  addField('Year', claim.vehicle_year);
  addField('VIN', claim.vehicle_vin);
  addField('License Plate', claim.vehicle_license_plate);
  addField('Ownership Status', claim.vehicle_ownership_status);
  addField('Odometer', claim.vehicle_odometer ? `${claim.vehicle_odometer.toLocaleString()} mi` : null);
  addField('Purchase Date', claim.vehicle_purchase_date ? formatDate(claim.vehicle_purchase_date) : null);

  // Policy Information
  addSectionHeader('POLICY INFORMATION');
  addField('Policy Number', claim.policy_number);

  // AI Assessment
  const assessment = claim.ai_assessment;
  if (assessment) {
    addSectionHeader('AI ASSESSMENT');
    
    // Damage Assessment
    if (assessment.damage_assessment) {
      addField('Estimated Cost', assessment.damage_assessment.estimated_cost_range);
      addField('Repair Complexity', assessment.damage_assessment.repair_complexity);
      addField('Drivable', assessment.damage_assessment.is_drivable ? 'Yes' : 'No');
      addField('Total Loss Risk', assessment.damage_assessment.total_loss_risk);
      
      if (assessment.damage_assessment.damage_types?.length > 0) {
        addField('Damage Types', assessment.damage_assessment.damage_types.join(', '));
      }
      if (assessment.damage_assessment.affected_areas?.length > 0) {
        addField('Affected Areas', assessment.damage_assessment.affected_areas.join(', '));
      }
    }

    // Recommendations
    if (assessment.recommendations) {
      addField('Estimated Timeline', assessment.recommendations.estimated_timeline);
      if (assessment.recommendations.immediate_actions?.length > 0) {
        addField('Immediate Actions', assessment.recommendations.immediate_actions.join('; '));
      }
    }

    // Reasoning
    if (assessment.reasoning) {
      yPos += 3;
      addText('Assessment Reasoning:', 10, true);
      addText(assessment.reasoning, 9);
    }

    // Fraud Indicators
    if (assessment.fraud_indicators?.has_red_flags) {
      addSectionHeader('FRAUD FLAGS');
      addField('Status', assessment.fraud_indicators.verification_status);
      if (assessment.fraud_indicators.concerns?.length > 0) {
        assessment.fraud_indicators.concerns.forEach((concern: string, i: number) => {
          addText(`• ${concern}`, 9);
        });
      }
    }

    // Q&A Summary
    if (assessment.qa_summary) {
      addSectionHeader('ASSESSMENT SUMMARY');
      addField('Credibility Score', assessment.qa_summary.credibility_score ? `${Math.round(assessment.qa_summary.credibility_score * 100)}%` : null);
      
      if (assessment.qa_summary.overall_impression) {
        addText('Overall Impression:', 10, true);
        addText(assessment.qa_summary.overall_impression, 9);
      }

      if (assessment.qa_summary.key_takeaways?.length > 0) {
        yPos += 3;
        addText('Key Takeaways:', 10, true);
        assessment.qa_summary.key_takeaways.forEach((takeaway: any) => {
          const category = takeaway.category?.replace('_', ' ').toUpperCase() || '';
          addText(`[${category}] ${takeaway.insight}`, 9);
        });
      }

      if (assessment.qa_summary.gaps_and_concerns?.length > 0) {
        yPos += 3;
        addText('Gaps & Concerns:', 10, true);
        assessment.qa_summary.gaps_and_concerns.forEach((gap: any) => {
          addText(`• [${gap.severity?.toUpperCase()}] ${gap.issue}`, 9);
          if (gap.recommendation) {
            addText(`  Recommendation: ${gap.recommendation}`, 8);
          }
        });
      }
    }
  }

  // Follow-up Q&A
  const answeredQuestions = questions.filter(q => q.answer && q.answer.trim() !== '');
  if (answeredQuestions.length > 0) {
    addSectionHeader('FOLLOW-UP QUESTIONS & ANSWERS');
    answeredQuestions.forEach((qa, i) => {
      addText(`Q${i + 1}: ${qa.question}`, 9, true);
      addText(`A: ${qa.answer}`, 9);
      yPos += 2;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  // Save the PDF
  doc.save(`claim-report-${claim.claim_number}.pdf`);
};
