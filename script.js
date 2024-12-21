function prettyCNF(cnf) {
    let str = "[\n";
    for (let i=0; i<cnf.length-1; i++) {
        str += "  " + JSON.stringify(cnf[i]) + ",\n";
    }
    str += "  " + JSON.stringify(cnf[cnf.length-1]) + "\n";
    str += "]";
    return str;
}

window.addEventListener("load", () => {
    const computeButton = document.getElementById("compute-button");
    computeButton.addEventListener("click", async () => {
        computeButton.disabled = true;

        // --------------------
        // parse the dimacs cnf
        // --------------------

        let cnfInputText = document.getElementById("sat-input").value;

        cnfInputText = cnfInputText.replaceAll(/^c.*$/gm, "").trim();

        if (!cnfInputText.startsWith("p cnf ")) {
            document.getElementById("result-sat").textContent = "syntax error";
            return;
        }

        cnfInputText = cnfInputText.substring(6);

        const cnfInputTokens = cnfInputText.split(/\s+/);

        const cnf_sat = [];

        let curClause = null;

        let maxVar = 0;

        for (let i = 2; i < cnfInputTokens.length; i++) {
            const cur = parseInt(cnfInputTokens[i]);
            if (cur == 0) {
                curClause = null;
            } else {
                if (curClause == null) {
                    curClause = [];
                    cnf_sat.push(curClause);
                }
                curClause.push(cur);
                if (Math.abs(cur) > maxVar) {
                    maxVar = Math.abs(cur);
                }
            }
        }

        for (const clause of cnf_sat) {
            clause.sort((a,b) => Math.abs(a) - Math.abs(b));
        }

        document.getElementById("result-sat").textContent = prettyCNF(cnf_sat);

        // ----------------
        // convert to 3-SAT
        // ----------------

        let log_3sat = "";

        const cnf_3sat = [];

        for (const origClause of cnf_sat) {
            if (origClause.length <= 3) {
                cnf_3sat.push(origClause);
            } else {
                // now we need to split into first two, then always one and then the last two
                cnf_3sat.push([origClause[0], origClause[1], maxVar+1]);
                maxVar++;
                log_3sat += "<li>splitting using " + maxVar + "</li>";
                for (let i = 2; i < origClause.length - 2; i++) {
                    cnf_3sat.push([origClause[i], -maxVar, maxVar+1]);
                    maxVar++;
                    log_3sat += "<li>splitting using " + maxVar + "</li>";
                }
                cnf_3sat.push([origClause[origClause.length-2], origClause[origClause.length-1], -maxVar]);
            }
        }

        document.getElementById("log-3sat").innerHTML = "<ul>" + log_3sat + "</ul>";

        document.getElementById("result-3sat").textContent = prettyCNF(cnf_3sat);

        // ------------------
        // convert to 3,3-SAT
        // ------------------

        const varUseCount = [];

        for (const clause of cnf_3sat) {
            for (const literal of clause) {
                const variable = Math.abs(literal);
                if (variable in varUseCount) {
                    varUseCount[variable]++;
                } else {
                    varUseCount[variable] = 1;
                }
            }
        }

        let log_33sat = "";

        const cnf_33sat = [];

        const replacements = [];

        for (const origClause of cnf_3sat) {
            const newClause = [];
            for (let i = 0; i < origClause.length; i++) {
                const variable = Math.abs(origClause[i]);
                if (varUseCount[variable] <= 3) {
                    newClause.push(origClause[i]);
                } else {
                    if (!(variable in replacements)) {
                        replacements[variable] = [variable];
                        newClause.push(origClause[i]);
                    } else {
                        maxVar++;
                        newClause.push(maxVar * Math.sign(origClause[i]));
                        replacements[variable].push(maxVar);
                    }
                }
            }
            newClause.sort((a,b) => Math.abs(a) - Math.abs(b));
            cnf_33sat.push(newClause);
        }

        for (const varString in replacements) {
            const variable = parseInt(varString);
            log_33sat += "<li>replacing " + variable + " with " + JSON.stringify(replacements[variable]) + "</li>";
            for (let i = 0; i < replacements[variable].length - 1; i++) {
                cnf_33sat.push([replacements[variable][i], -replacements[variable][i+1]]);
            }
            cnf_33sat.push([-replacements[variable][0], replacements[variable][replacements[variable].length - 1]]);
        }

        document.getElementById("log-33sat").innerHTML = "<ul>" + log_33sat + "</ul>";

        document.getElementById("result-33sat").textContent = prettyCNF(cnf_33sat);

        // --------------
        // compute SNQRCD
        // --------------

        let log_snqcrcd = "";

        log_snqcrcd += "<li>There are " + maxVar + " variables, so the size of each gadget will be (" + maxVar + " * 14)² = " + (maxVar*14) + "².</li>";
        log_snqcrcd += "<li>There are " + maxVar + " variables and " + cnf_33sat.length + " clauses, so there will be " + maxVar + " + " + cnf_33sat.length + " = " + (maxVar + cnf_33sat.length) + " gadgets."

        document.getElementById("log-snqcrcd").innerHTML += "<ul>" + log_snqcrcd + "</ul>";

        computeButton.disabled = false;
    });
});
