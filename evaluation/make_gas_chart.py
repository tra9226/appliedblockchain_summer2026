# make_gas_chart.py
# Reproduces the record-size sweep figure. Run:  python make_gas_chart.py
# Needs matplotlib:  pip install matplotlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# --- data from evaluation/measure-gas-by-size.js (real gasUsed) ---
courses  = [1, 5, 10, 20, 40]
anchored = [162271, 162271, 162271, 162271, 162271]
naive    = [348281, 529858, 756854, 1210918, 2119053]

a_k = [g / 1000 for g in anchored]   # thousands of gas
n_k = [g / 1000 for g in naive]

plt.rcParams.update({"font.family": "serif", "font.size": 9, "axes.linewidth": 0.8})
fig, ax = plt.subplots(figsize=(3.5, 2.6), dpi=300)   # ~1 IEEE column wide

ax.plot(courses, n_k, marker="s", markersize=4, linewidth=1.4,
        color="#333333", linestyle="-",  label="Full-record on-chain")
ax.plot(courses, a_k, marker="o", markersize=4, linewidth=1.4,
        color="#888888", linestyle="--", label="Hash-anchored")

ax.set_xlabel("Transcript size (number of courses)")
ax.set_ylabel("Issuance gas (thousands)")
ax.set_xlim(0, 42)
ax.set_ylim(0, 2300)
ax.grid(True, linewidth=0.4, alpha=0.5)
ax.legend(frameon=False, fontsize=8, loc="upper left")
ax.annotate("constant 162,271 gas", xy=(20, 162.271), xytext=(11, 470),
            fontsize=7, color="#555555",
            arrowprops=dict(arrowstyle="->", color="#888888", lw=0.7))

fig.tight_layout(pad=0.3)
fig.savefig("gas_by_size.png", bbox_inches="tight")   # PNG for the repo/slides
fig.savefig("gas_by_size.pdf", bbox_inches="tight")   # vector version if you want it
print("wrote gas_by_size.png and gas_by_size.pdf")
