  const exportXlsx = async () => {
    try {
      const finalDims = dateOn ? [...dims, "date"] : dims;
      const res = await API.post(
        "analytics/pivot/export/",
        {
          dims: finalDims,
          values: buildValuesPayload(),
          from,
          to,
          date_granularity: dateOn ? gran : null,
        },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial_dashboard_${from}_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Could not export.");
    }
  };
