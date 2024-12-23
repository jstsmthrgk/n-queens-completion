function prettyCNF(cnf) {
    let str = "[\n";
    for (let i=0; i<cnf.length-1; i++) {
        str += "  " + JSON.stringify(cnf[i]) + ",\n";
    }
    str += "  " + JSON.stringify(cnf[cnf.length-1]) + "\n";
    str += "]";
    return str;
}

function prettyArray(arr, indent) {
    out = "";
    for (let i = 0; i < arr.length-1; i++) {
        if (i%16 == 0) {
            out += "\n";
            for (let j = 0; j < indent; j++) {
                out += " ";
            }
        }
        out += arr[i] + ",";
    }
    if (arr.length > 0) {
        if ((arr.length-1) % 16 == 0) {
            out += "\n";
            for (let j = 0; j < indent; j++) {
                out += " ";
            }
        }
        out += arr[arr.length-1];
    }
    return out;
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

        log_snqcrcd += "<li>There are " + maxVar + " variables, so the size of each gadget will be (" + maxVar + " * 21)² = " + (maxVar*21) + "².</li>";
        const n_snqcrcd = maxVar*21;
        log_snqcrcd += "<li>There are " + maxVar + " variables and " + cnf_33sat.length + " clauses, so there will be " + maxVar + " + " + cnf_33sat.length + " = " + (maxVar + cnf_33sat.length) + " gadgets."
        
        set_snqcrcd = [];
        
        num_occurences = [];
        
        for (let i = 0; i < maxVar; i++) {
            set_snqcrcd.push({
                "$comment": "variable " + (i+1),
                n: n_snqcrcd,
                C: [0+21*i,1+21*i,3+21*i],
                R: [0+21*i,1+21*i,3+21*i],
                "D-": [],
                "D+": []
            });
            num_occurences[i+1] = 0;
        }
        
        const offsets = {}
        offsets[-1] = [0,4,5];
        offsets[1] = [1,2,6];
        
        for (const clause of cnf_33sat) {
            if (clause.length == 2) {
                v0 = Math.abs(clause[0]);
                v1 = Math.abs(clause[1]);
                c0 = (v0-1)*21 + offsets[Math.sign(clause[0])][num_occurences[v0]];
                c1 = (v1-1)*21 + offsets[Math.sign(clause[1])][num_occurences[v1]];
                num_occurences[v0]++;
                num_occurences[v1]++;
                set_snqcrcd.push({
                    "$comment": "clause " + JSON.stringify(clause),
                    n: n_snqcrcd,
                    C: [c0,c1],
                    R: [0],
                    "D-": [],
                    "D+": []
                });
            } else {
                v0 = Math.abs(clause[0]);
                v1 = Math.abs(clause[1]);
                v2 = Math.abs(clause[2]);
                c0 = (v0-1)*21 + offsets[Math.sign(clause[0])][num_occurences[v0]];
                c1 = (v1-1)*21 + offsets[Math.sign(clause[1])][num_occurences[v1]];
                c2 = (v2-1)*21 + offsets[Math.sign(clause[2])][num_occurences[v2]];
                num_occurences[v0]++;
                num_occurences[v1]++;
                num_occurences[v2]++;
                set_snqcrcd.push({
                    "$comment": "clause " + JSON.stringify(clause),
                    n: n_snqcrcd,
                    C: [c0,c1,c2],
                    R: [0,7,14],
                    "D-": [c0-14,c2-7],
                    "D+": []
                });

            }
        }

        document.getElementById("log-snqcrcd").innerHTML = "<ul>" + log_snqcrcd + "</ul>";

        let res_snqrcd = "";
        for (const subproblem of set_snqcrcd) {
            res_snqrcd += "\n";
            res_snqrcd += "  {\n";
            res_snqrcd += "    \"$comment\":\"" + subproblem["$comment"] + "\",\n";
            res_snqrcd += "    \"n\":" + subproblem["n"] + ",\n";
            res_snqrcd += "    \"C\":" + JSON.stringify(subproblem["C"]) + ",\n";
            res_snqrcd += "    \"R\":" + JSON.stringify(subproblem["R"]) + ",\n";
            res_snqrcd += "    \"D-\":" + JSON.stringify(subproblem["D-"]) + ",\n";
            res_snqrcd += "    \"D+\":" + JSON.stringify(subproblem["D+"]) + "\n";
            res_snqrcd += "  },";
        }
        res_snqrcd = res_snqrcd.substring(0,res_snqrcd.length-1);

        document.getElementById("result-snqcrcd").textContent = "[" + res_snqrcd + "\n]";

        // --------------
        // compute NQCRCD
        // --------------

        let log_nqcrcd = "";
        
        n_nqcrcd = (set_snqcrcd.length*2-1) * set_snqcrcd[0].n;
        log_nqcrcd += "<li>There are " + set_snqcrcd.length + " subproblems of size " + set_snqcrcd[0].n + " so the size will be (" + set_snqcrcd.length + "*2-1) * " + set_snqcrcd[0].n + " = " + n_nqcrcd + "." ;

        const obj_nqcrcd = {
            n: n_nqcrcd,
            C: [],
            R: [],
            "D-": [],
            "D+": []
        };
        
        for (let i = 0; i < set_snqcrcd.length; i++) {
            obj_nqcrcd.C.push(...set_snqcrcd[i].C.map(c => c+2*n_snqcrcd*(set_snqcrcd.length-1-i)));
            obj_nqcrcd.R.push(...set_snqcrcd[i].R.map(r => r+2*n_snqcrcd*i));
            obj_nqcrcd["D-"].push(...set_snqcrcd[i]["D-"].map(d => d+2*n_snqcrcd*(set_snqcrcd.length-1-2*i)));
        }
        
        obj_nqcrcd.C.sort((a,b) => a-b);
        obj_nqcrcd.R.sort((a,b) => a-b);
        obj_nqcrcd["D-"].sort((a,b) => a-b);
        
        for (let i = 0; i < 2*n_snqcrcd*(set_snqcrcd.length-1)+1; i++) {
            obj_nqcrcd["D+"].push(i);
        }

        for (let i = 2*n_snqcrcd*(set_snqcrcd.length); i < 4*n_snqcrcd*(set_snqcrcd.length) - 2; i++) {
            obj_nqcrcd["D+"].push(i);
        }

        document.getElementById("log-nqcrcd").innerHTML = "<ul>" + log_nqcrcd + "</ul>";
        
        let res_nqcrcd = "";
        res_nqcrcd += "{\n";
        res_nqcrcd += "  \"n\":" + obj_nqcrcd.n + ",\n";
        res_nqcrcd += "  \"C\":[" + prettyArray(obj_nqcrcd.C,4) + "\n  ],\n";
        res_nqcrcd += "  \"R\":[" + prettyArray(obj_nqcrcd.R,4) + "\n  ],\n";
        res_nqcrcd += "  \"D-\":[" + prettyArray(obj_nqcrcd["D-"],4) + "\n  ],\n";
        res_nqcrcd += "  \"D+\":[" + prettyArray(obj_nqcrcd["D+"],4) + "\n  ],\n";
        res_nqcrcd += "}"
        
        document.getElementById("result-nqcrcd").textContent = res_nqcrcd;

        computeButton.disabled = false;
    });
});
