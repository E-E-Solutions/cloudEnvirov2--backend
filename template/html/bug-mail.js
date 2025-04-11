const htmlBodyHandler = (Title, ReportedBy, Date, Summary, Environment, errorInfo) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f3f4f6;
      padding: 40px;
      color: #1f2937;
    }

    .card {
      max-width: 600px;
      margin: auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
      padding: 32px;
      line-height: 1.6;
    }

    h2 {
      color: #dc2626;
      margin-bottom: 24px;
      font-size: 24px;
      border-bottom: 2px solid #f3f4f6;
      padding-bottom: 8px;
    }

    .section {
      margin-bottom: 20px;
    }

    .label {
      font-weight: 600;
      margin-bottom: 6px;
      display: block;
      color: #374151;
    }

    .value {
      background-color: #f9fafb;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .footer {
      text-align: center;
      margin-top: 32px;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>🐞 Bug Report</h2>


    <div class="section">
      <div class="label">Title</div>
      <div class="value">${Title}</div>
    </div>
    <div class="section">
      <div class="label">Reported By</div>
      <div class="value">${ReportedBy}</div>
    </div>

    <div class="section">
      <div class="label">Date</div>
      <div class="value">${Date}</div>
    </div>

    <div class="section">
      <div class="label">Summary</div>
      <div class="value">${Summary}</div>
    </div>

    <div class="section">
      <div class="label">Environment</div>
      <div class="value">
       ${JSON.stringify(Environment)}
      </div>
    </div>
    <div class="section">
      <div class="label">Error Logs</div>
      <div class="value">
       ${errorInfo}
      </div>
    </div>

    <div class="footer">
      E&E Solutions Pvt Ltd – Bug Tracking
    </div>
  </div>
</body>
</html>


  `;
};

module.exports = htmlBodyHandler;
