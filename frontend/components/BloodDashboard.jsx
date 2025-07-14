// frontend/components/BloodDashboard.jsx
const BloodDashboard = () => {
    const [stats, setStats] = useState(null);
  
    useEffect(() => {
      fetch('/api/blood-stocks/stats')
        .then(res => res.json())
        .then(data => {
          const formatted = data.map(item => ({
            ...item,
            status: item.total < 100 ? 'critical' : 'normal'
          }));
          setStats(formatted);
        });
    }, []);
  
    return (
      <div className="grid grid-cols-4 gap-4">
        <StockChart data={stats} />
        <CriticalAlerts />
        <DonationCalendar />
        <CenterStockTable />
      </div>
    );
  };