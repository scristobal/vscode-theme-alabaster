// Declarations stand out; references stay plain.
fn summarize(values: &[i32], limit: usize) -> i32 {
    let first = values[0];
    let (left, right) = (first, 2);
    let adjust = |amount: i32| amount + first;
    let mut total = adjust(left);

    for value in values.iter().take(limit) {
        total += value;
    }

    if let Some(extra) = values.get(right as usize) {
        total += extra;
    }

    total
}

fn main() {
    let values = [1, 2, 3];
    let total = summarize(&values, 2);
    println!("Total: {}", total);
}
