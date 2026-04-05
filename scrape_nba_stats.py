import pandas as pd

# Read the HTML table from Basketball Reference
url = "https://www.basketball-reference.com/leagues/NBA_2026_totals.html"

# pd.read_html() returns a list of tables found on the page
tables = pd.read_html(url)

# Get the main stats table (first one)
df = tables[0]

# Remove any repeated header rows (where 'Rk' column equals 'Rk')
if 'Rk' in df.columns:
    df = df[df['Rk'] != 'Rk']

# Save to CSV
df.to_csv("nba_players_2025-26_stats.csv", index=False)

print(f"Saved {len(df)} players to nba_players_2025-26_stats.csv")
print(f"Columns: {list(df.columns)}")
